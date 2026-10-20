/**
 * Provider-level soft rate limiter: RPM + TPM per provider per natural minute window.
 * Verified upstream: CodeCraft fixed-window per minute, :00 UTC aligned (Resets every minute).
 * Natural-minute is correct; add header-aware precise wait (X-RateLimit-Reset / Retry-After)
 * and burst smoothing so 429s converge without busy-loop.
 * When the window is full, requests queue until precise reset, not estimated msToNextMinute only.
 */

export type ProviderRateLimitConfig = {
  rpm?: number;
  tpm?: number;
};

export type ProviderRateLimitsConfig = Record<string, ProviderRateLimitConfig>;

type ProviderWindow = {
  minute: number;
  rpm: number;
  tpm: number;
  queue: Array<{ resolve: () => void; reject: (e: Error) => void }>;
};

const windows = new Map<string, ProviderWindow>();
// Precise reset from upstream headers (429 feedback). Unix-ms, per provider.
const rateLimitResetAtMs = new Map<string, number>();
let sweepTimer: ReturnType<typeof setInterval> | undefined;

function nowMinute(): number {
  return Math.floor(Date.now() / 60000);
}

function msToNextMinute(): number {
  return 60000 - (Date.now() % 60000) + 10;
}

function getWindow(providerKey: string): ProviderWindow {
  const m = nowMinute();
  const w = windows.get(providerKey);
  if (w && w.minute === m) return w;
  // new minute: reset counters and flush any old queue (should be empty after wait)
  const fresh: ProviderWindow = { minute: m, rpm: 0, tpm: 0, queue: w?.queue ?? [] };
  windows.set(providerKey, fresh);
  return fresh;
}

function sweep(): void {
  const cur = nowMinute();
  for (const [key, w] of windows) {
    if (w.minute !== cur && w.queue.length === 0 && w.rpm === 0 && w.tpm === 0) {
      windows.delete(key);
    }
  }
  const now = Date.now();
  for (const [k, at] of rateLimitResetAtMs) { if (at <= now) rateLimitResetAtMs.delete(k); }
}

function ensureSweep(): void {
  if (!sweepTimer) {
    sweepTimer = setInterval(sweep, 60000);
    sweepTimer.unref?.();
  }
}

/**
 * Provider-name normalization: lower-case, trim.  "CodeCraft" -> "codecraft"
 */
function parseRetryAfterMs(value: string | null | undefined): number | undefined {
  const v = value?.trim(); if (!v) return undefined;
  const sec = Number(v); if (Number.isFinite(sec) && sec >= 0) return Math.round(sec * 1000);
  const d = Date.parse(v); if (Number.isFinite(d)) return Math.max(0, d - Date.now());
  return undefined;
}
function pickHeader(headers: Headers | Record<string, string>, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) { if (k.toLowerCase() === lower) return v; }
  return undefined;
}
function msToReset(providerKey: string): number {
  const precise = rateLimitResetAtMs.get(providerKey);
  if (precise != null) {
    const ms = Math.max(0, precise - Date.now()) + 10;
    if (ms > 0 && ms <= 60000) return ms;
  }
  return msToNextMinute();
}
export function recordRateLimitFeedback(providerKey: string, headers: Headers | Record<string, string>): void {
  const norm = normalizeProviderKey(providerKey); if (!norm) return;
  const key = norm;
  const retryAfter = parseRetryAfterMs(pickHeader(headers, "Retry-After") ?? pickHeader(headers, "retry-after"));
  const resetUnix = pickHeader(headers, "X-RateLimit-Reset") ?? pickHeader(headers, "x-ratelimit-reset");
  const resetTokensUnix = pickHeader(headers, "X-RateLimit-Reset-Tokens") ?? pickHeader(headers, "x-ratelimit-reset-tokens");
  let resetMs: number | undefined;
  if (retryAfter != null) resetMs = Date.now() + retryAfter;
  else if (resetUnix && /^\d+$/.test(resetUnix.trim())) resetMs = Number(resetUnix.trim()) * 1000;
  else if (resetTokensUnix && /^\d+$/.test(resetTokensUnix.trim())) resetMs = Number(resetTokensUnix.trim()) * 1000;
  if (resetMs == null || !Number.isFinite(resetMs) || resetMs <= Date.now()) return;
  if (resetMs - Date.now() > 65000) return;
  const prev = rateLimitResetAtMs.get(key);
  if (prev == null || resetMs > prev) rateLimitResetAtMs.set(key, resetMs);
}
export function _resetRateLimitFeedbackForTest(providerKey?: string): void {
  if (providerKey) { const k = normalizeProviderKey(providerKey); if (k) rateLimitResetAtMs.delete(k); }
  else rateLimitResetAtMs.clear();
}

export function normalizeProviderKey(name: string | undefined): string | undefined {
  const k = typeof name === "string" ? name.trim().toLowerCase() : undefined;
  return k && k.length > 0 ? k : undefined;
}

/**
 * Soft gate: if the provider's current minute window still has headroom for this request's
 * estimated tokens, consume RPM/TPM counters and return immediately.
 * If full, wait until next natural minute boundary, then retry.  Each waiter is FIFO per provider.
 */
export async function acquireProviderWindow(
  providerKey: string,
  estimatedTokens: number,
  limits: ProviderRateLimitsConfig,
  opts: { signal?: AbortSignal; maxWaitMs?: number } = {}
): Promise<void> {
  const cfg = limits[providerKey];
  if (!cfg || (cfg.rpm == null && cfg.tpm == null)) return;
  const rpm = cfg.rpm ?? Infinity;
  const tpm = cfg.tpm ?? Infinity;
  const tokens = Math.max(1, Math.ceil(estimatedTokens));
  // 默认最多等 1 个自然分钟边界 + 5s 抖动缓冲，超过则放行让上游真实 429 决定，避免网关内静默卡 3 分钟
  const maxWaitMs = opts.maxWaitMs ?? msToNextMinute() + 5000;

  ensureSweep();

  const deadline = Date.now() + maxWaitMs;
  // 惊群防护：同 provider 同一分钟的等待者共享同一个 minute 边界 Promise，避免 100 并发一起 setTimeout 到同一毫秒
  let attemptJitterMs = 0;

  while (true) {
    if (opts.signal?.aborted) throw opts.signal.reason ?? new Error("provider window cancelled");

    const w = getWindow(providerKey);
    const wouldRpm = w.rpm + 1;
    const wouldTpm = w.tpm + tokens;
    const hasHeadroom = wouldRpm <= rpm && wouldTpm <= tpm;

    if (hasHeadroom) {
      w.rpm = wouldRpm;
      w.tpm = wouldTpm;
      return;
    }

    const waitMs = msToReset(providerKey) + attemptJitterMs;
    if (Date.now() + waitMs > deadline) {
      // Exceeded max wait: caller will proceed and let upstream decide (will become real 429).
      return;
    }

    await waitForMinuteBoundary(providerKey, opts.signal);
    // 醒来后加 0-200ms 随机抖动，避免下一分钟 0ms 时刻 N 个请求同时抢同一窗口
    attemptJitterMs = Math.floor(Math.random() * 200);
  }
}

// 同一 provider 的并发等待者复用同一个分钟边界 timer，避免惊群
const pendingBoundary = new Map<string, { minute: number; promise: Promise<void> }>();
function waitForMinuteBoundary(providerKey: string, signal?: AbortSignal): Promise<void> {
  const curMinute = nowMinute();
  const cached = pendingBoundary.get(providerKey);
  if (cached && cached.minute === curMinute) {
    if (!signal) return cached.promise;
    // 有 signal 的等待者不能复用不可取消的 promise，单独建一个可取消的
  } else if (!signal) {
    const ms = msToReset(providerKey);
    const p = new Promise<void>((resolve) => {
      setTimeout(() => {
        pendingBoundary.delete(providerKey);
        resolve();
      }, ms);
    });
    pendingBoundary.set(providerKey, { minute: curMinute, promise: p });
    return p;
  }
  const ms = msToReset(providerKey);
  let onAbort: (() => void) | undefined;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      // minute has rolled; loop will see fresh window
      resolve();
    }, ms);

    if (!signal) return;

    onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("provider window cancelled"));
    };
    if (signal.aborted) {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("provider window cancelled"));
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// Test helper: inject limits snapshot without needing AppConfig plumb in every caller.
// A tiny global so pipeline/executor can share the same limits without circular import.
let globalLimits: ProviderRateLimitsConfig | undefined;
export function setProviderRateLimits(limits: ProviderRateLimitsConfig): void {
  globalLimits = limits;
}
export function getProviderRateLimits(): ProviderRateLimitsConfig | undefined {
  return globalLimits;
}
/** Exposed for tests: current window counters */
export function windowSnapshot(providerKey: string): { minute: number; rpm: number; tpm: number } | undefined {
  const w = windows.get(providerKey);
  return w ? { minute: w.minute, rpm: w.rpm, tpm: w.tpm } : undefined;
}
export function _resetProviderWindowsForTest(): void {
  windows.clear();
  rateLimitResetAtMs.clear();
  pendingBoundary.clear();
}
