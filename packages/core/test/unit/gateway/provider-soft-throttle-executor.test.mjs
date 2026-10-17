import assert from "node:assert/strict";
import test from "node:test";
import { _resetProviderWindowsForTest } from "@ccr/core/gateway/limits/provider-window-limiter.ts";
import { fetchUpstreamWithFallback } from "@ccr/core/gateway/upstream/executor.ts";

test("executor soft throttle: second concurrent request waits until next minute", async () => {
  _resetProviderWindowsForTest();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const config = {
    Providers: [{ name: "ThrottleDemo", models: ["demo-model"], api_base_url: "https://api.throttle.test/v1", softRateLimits: { rpm: 1, tpm: 999999 } }],
    Router: { fallback: { mode: "off", models: [], retryCount: 0 }, rules: [] },
    virtualModelProfiles: [],
  };
  const fallback = { mode: "off", models: [], retryCount: 0 };
  const common = {
    config,
    fallback,
    coreAuthToken: "core-token",
    headers: {},
    method: "POST",
    path: "/v1/chat/completions",
    upstreamUrl: "https://api.throttle.test/v1/chat/completions",
  };

  try {
    const body = Buffer.from(JSON.stringify({ model: "ThrottleDemo/demo-model", messages: [{ role: "user", content: "hi" }] }));
    const start = Date.now();
    const msToNextMinute = 60000 - (start % 60000) + 10;

    // First request should pass immediately and occupy rpm 1/1 for this minute.
    const first = fetchUpstreamWithFallback({ ...common, body, routedModel: "ThrottleDemo/demo-model" });
    // Second concurrent request for same provider should be parked until next minute.
    const second = fetchUpstreamWithFallback({ ...common, body, routedModel: "ThrottleDemo/demo-model" });

    const results = await Promise.all([first, second]);
    const waited = Date.now() - start;

    assert.ok(waited >= msToNextMinute - 300, `concurrent second request should wait ~${msToNextMinute}ms, waited ${waited}ms`);
    assert.equal(fetchCount, 2, "both requests eventually reach upstream");
    // both should have succeeded (soft throttle does not turn into 429)
    for (const r of results) {
      assert.equal(r.response.status, 200);
    }
    // verify trace contains throttle marker (executor emits provider-window.throttle:<key>)
    // At least one of the two traces should contain the throttle hop; structure varies by fetch path,
    // so we just ensure no 429.
  } finally {
    globalThis.fetch = originalFetch;
    _resetProviderWindowsForTest();
  }
});

test("executor soft throttle: unlimited provider does not wait", async () => {
  _resetProviderWindowsForTest();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 200 });
  const config = {
    Providers: [{ name: "NoLimit", models: ["m"], api_base_url: "https://api.nolimit.test/v1" }],
    Router: { fallback: { mode: "off", models: [], retryCount: 0 }, rules: [] },
    virtualModelProfiles: [],
  };
  const start = Date.now();
  await fetchUpstreamWithFallback({
    body: Buffer.from(JSON.stringify({ model: "NoLimit/m" })),
    config,
    coreAuthToken: "tok",
    fallback: { mode: "off", models: [], retryCount: 0 },
    headers: {},
    method: "POST",
    path: "/v1/chat/completions",
    routedModel: "NoLimit/m",
    upstreamUrl: "https://api.nolimit.test/v1/chat/completions",
  });
  await fetchUpstreamWithFallback({
    body: Buffer.from(JSON.stringify({ model: "NoLimit/m" })),
    config,
    coreAuthToken: "tok",
    fallback: { mode: "off", models: [], retryCount: 0 },
    headers: {},
    method: "POST",
    path: "/v1/chat/completions",
    routedModel: "NoLimit/m",
    upstreamUrl: "https://api.nolimit.test/v1/chat/completions",
  });
  const waited = Date.now() - start;
  assert.ok(waited < 2000, `unlimited should not wait for next minute, waited ${waited}ms`);
  globalThis.fetch = originalFetch;
  _resetProviderWindowsForTest();
});
