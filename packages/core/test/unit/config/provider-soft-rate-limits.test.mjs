import assert from "node:assert/strict";
import test from "node:test";

test("parseProviderSoftRateLimits clamps rpm/tpm and handles snake_case", async () => {
  const { parseProviderSoftRateLimitsForTest, parseProvidersForTest } = await import("@ccr/core/config/config.ts");

  assert.deepEqual(parseProviderSoftRateLimitsForTest({ rpm: 3000, tpm: 5000000 }), { rpm: 3000, tpm: 5000000 });
  // clamp: above max
  assert.deepEqual(parseProviderSoftRateLimitsForTest({ rpm: 999999, tpm: 999999999 }), { rpm: 100000, tpm: 10000000 });
  // zero / negative / non-integer dropped
  assert.equal(parseProviderSoftRateLimitsForTest({ rpm: 0 }), undefined);
  assert.equal(parseProviderSoftRateLimitsForTest({ rpm: -5 }), undefined);
  assert.equal(parseProviderSoftRateLimitsForTest(null), undefined);
  assert.equal(parseProviderSoftRateLimitsForTest({}), undefined);
  // snake_case compat
  const viaProvider = parseProvidersForTest([{ name: "x", models: ["m"], soft_rate_limits: { rpm: 10, tpm: 20 } }]);
  assert.deepEqual(viaProvider?.[0]?.softRateLimits, { rpm: 10, tpm: 20 });
});

test("parseProviders softRateLimits empty means unlimited", async () => {
  const { parseProvidersForTest } = await import("@ccr/core/config/config.ts");
  const providers = parseProvidersForTest([
    { name: "NoLimit", models: ["m"] },
    { name: "RpmOnly", models: ["m"], softRateLimits: { rpm: 100 } },
    { name: "TpmOnly", models: ["m"], softRateLimits: { tpm: 200 } },
    { name: "Both", models: ["m"], softRateLimits: { rpm: 1, tpm: 1 } },
    { name: "ZeroIgnored", models: ["m"], softRateLimits: { rpm: 0, tpm: 0 } },
  ]);
  assert.equal(providers?.[0]?.softRateLimits, undefined);
  assert.deepEqual(providers?.[1]?.softRateLimits, { rpm: 100 });
  assert.deepEqual(providers?.[2]?.softRateLimits, { tpm: 200 });
  assert.deepEqual(providers?.[3]?.softRateLimits, { rpm: 1, tpm: 1 });
  assert.equal(providers?.[4]?.softRateLimits, undefined);
});

test("parseProviderSoftRateLimits handles RPM and TPM variants", async () => {
  const { parseProvidersForTest } = await import("@ccr/core/config/config.ts");
  const providers = parseProvidersForTest([
    { name: "A", models: ["m"], softRateLimits: { RPM: 50 } },
    { name: "B", models: ["m"], softRateLimits: { TPM: 999 } },
  ]);
  assert.deepEqual(providers?.[0]?.softRateLimits, { rpm: 50 });
  assert.deepEqual(providers?.[1]?.softRateLimits, { tpm: 999 });
});
