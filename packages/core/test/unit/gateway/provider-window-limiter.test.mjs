import assert from "node:assert/strict";
import test from "node:test";
import {
  _resetProviderWindowsForTest,
  acquireProviderWindow,
  normalizeProviderKey,
  windowSnapshot,
} from "@ccr/core/gateway/limits/provider-window-limiter.ts";

test("normalizeProviderKey trims and lower-cases", () => {
  assert.equal(normalizeProviderKey("  CodeCraft "), "codecraft");
  assert.equal(normalizeProviderKey("CODECRAFT"), "codecraft");
  assert.equal(normalizeProviderKey(""), undefined);
  assert.equal(normalizeProviderKey(undefined), undefined);
  assert.equal(normalizeProviderKey("  "), undefined);
});

test("acquireProviderWindow respects rpm headroom and counts", async () => {
  _resetProviderWindowsForTest();
  await acquireProviderWindow("codecraft", 10, { codecraft: { rpm: 2 } });
  await acquireProviderWindow("codecraft", 10, { codecraft: { rpm: 2 } });
  assert.equal(windowSnapshot("codecraft")?.rpm, 2);
  _resetProviderWindowsForTest();
});

test("acquireProviderWindow respects tpm headroom", async () => {
  _resetProviderWindowsForTest();
  await acquireProviderWindow("demo", 100, { demo: { tpm: 150 } });
  assert.equal(windowSnapshot("demo")?.tpm, 100);
  await acquireProviderWindow("demo", 40, { demo: { tpm: 150 } });
  assert.equal(windowSnapshot("demo")?.tpm, 140);
  _resetProviderWindowsForTest();
});

test("provider keys are case-insensitive via normalizeProviderKey", async () => {
  _resetProviderWindowsForTest();
  await acquireProviderWindow(normalizeProviderKey("CodeCraft"), 1, { codecraft: { rpm: 5 } });
  await acquireProviderWindow(normalizeProviderKey("CODECRAFT"), 1, { codecraft: { rpm: 5 } });
  assert.equal(windowSnapshot("codecraft")?.rpm, 2);
  _resetProviderWindowsForTest();
});

test("acquireProviderWindow waits until next minute boundary when rpm is full", async () => {
  _resetProviderWindowsForTest();
  const now = Date.now();
  const msToNextMinute = 60000 - (now % 60000) + 10;
  // Fill rpm=1 Window with one request, next acquire must wait ~msToNextMinute
  await acquireProviderWindow("throttle-rpm", 1, { "throttle-rpm": { rpm: 1 } });
  assert.equal(windowSnapshot("throttle-rpm")?.rpm, 1);
  const start = Date.now();
  const pending = acquireProviderWindow("throttle-rpm", 1, { "throttle-rpm": { rpm: 1 } });
  // should not resolve immediately
  let resolved = false;
  pending.then(() => { resolved = true; });
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(resolved, false, "should be waiting for next minute");
  await pending;
  const waited = Date.now() - start;
  assert.ok(waited >= msToNextMinute - 200, `waited ${waited}ms should be ~${msToNextMinute}ms`);
  // new minute window starts at 1 again
  assert.equal(windowSnapshot("throttle-rpm")?.rpm, 1);
  _resetProviderWindowsForTest();
});

test("acquireProviderWindow abort signal interrupts waiting", async () => {
  _resetProviderWindowsForTest();
  await acquireProviderWindow("abort-demo", 1, { "abort-demo": { rpm: 1 } });
  const controller = new AbortController();
  const pending = acquireProviderWindow("abort-demo", 1, { "abort-demo": { rpm: 1 } }, { signal: controller.signal });
  setTimeout(() => controller.abort(new Error("cancelled")), 30);
  await assert.rejects(() => pending, /cancelled/);
  _resetProviderWindowsForTest();
});

test("acquireProviderWindow no-limit and empty limits are no-ops", async () => {
  _resetProviderWindowsForTest();
  await acquireProviderWindow("unlimited", 999999, {});
  await acquireProviderWindow("unlimited", 999999, { unlimited: {} });
  assert.equal(windowSnapshot("unlimited"), undefined);
  _resetProviderWindowsForTest();
});
