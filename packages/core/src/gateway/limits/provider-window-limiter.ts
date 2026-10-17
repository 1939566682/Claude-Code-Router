/**
 * Provider-level soft rate limiter: RPM + TPM per provider per natural minute window.
 * When the window is full, requests queue until next minute's boundary (60 - now%60).
 * Used to hold requests instead of returning 429 — all agents sharing the provider are accounted together.
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

    const waitMs = msToNextMinute() + attemptJitterMs;
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
    const ms = msToNextMinute();
    const p = new Promise<void>((resolve) => {
      setTimeout(() => {
        pendingBoundary.delete(providerKey);
        resolve();
      }, ms);
    });
    pendingBoundary.set(providerKey, { minute: curMinute, promise: p });
    return p;
  }
  const ms = msToNextMinute();
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
}
