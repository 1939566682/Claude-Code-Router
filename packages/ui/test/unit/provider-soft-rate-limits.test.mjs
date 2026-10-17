import assert from "node:assert/strict";
import test from "node:test";
import {
  createProviderDraft,
  createProviderDraftFromProvider,
  providerSoftRateLimitsFromDraft,
} from "@ccr/ui/pages/home/shared/providers.ts";

test("providerSoftRateLimitsFromDraft validates and clamps", () => {
  assert.deepEqual(providerSoftRateLimitsFromDraft({ softRateLimitRpm: "3000", softRateLimitTpm: "5000000" }), { rpm: 3000, tpm: 5000000 });
  assert.deepEqual(providerSoftRateLimitsFromDraft({ softRateLimitRpm: "", softRateLimitTpm: "" }), undefined);
  assert.deepEqual(providerSoftRateLimitsFromDraft({ softRateLimitRpm: "100", softRateLimitTpm: "" }), { rpm: 100 });
  assert.deepEqual(providerSoftRateLimitsFromDraft({ softRateLimitRpm: "", softRateLimitTpm: "200" }), { tpm: 200 });
  assert.match(String(providerSoftRateLimitsFromDraft({ softRateLimitRpm: "abc", softRateLimitTpm: "" })), /正整数/);
  assert.match(String(providerSoftRateLimitsFromDraft({ softRateLimitRpm: "0", softRateLimitTpm: "" })), /正整数/);
});

test("providerSoftRateLimits round-trip via draft", () => {
  const draft = createProviderDraft([]);
  assert.equal(draft.softRateLimitRpm, "");
  assert.equal(draft.softRateLimitTpm, "");
  const fromProvider = createProviderDraftFromProvider({ name: "Demo", models: ["m"], softRateLimits: { rpm: 123, tpm: 456 } });
  assert.equal(fromProvider.softRateLimitRpm, "123");
  assert.equal(fromProvider.softRateLimitTpm, "456");
});
