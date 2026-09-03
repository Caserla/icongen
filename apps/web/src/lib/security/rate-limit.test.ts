import assert from "node:assert/strict";
import test from "node:test";
import { consumeRateLimit, requestIpIdentity, requestRateLimitIdentity, resetRateLimitsForTests } from "./rate-limit";

test("blocks requests beyond the limit and reports retry time", () => {
  resetRateLimitsForTests();
  assert.equal(consumeRateLimit({ namespace: "test", identity: "a", limit: 2, windowMs: 1000, now: 0 }).allowed, true);
  assert.equal(consumeRateLimit({ namespace: "test", identity: "a", limit: 2, windowMs: 1000, now: 1 }).allowed, true);
  const blocked = consumeRateLimit({ namespace: "test", identity: "a", limit: 2, windowMs: 1000, now: 2 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
});

test("isolates identities and resets expired windows", () => {
  resetRateLimitsForTests();
  consumeRateLimit({ namespace: "test", identity: "a", limit: 1, windowMs: 1000, now: 0 });
  assert.equal(consumeRateLimit({ namespace: "test", identity: "b", limit: 1, windowMs: 1000, now: 1 }).allowed, true);
  assert.equal(consumeRateLimit({ namespace: "test", identity: "a", limit: 1, windowMs: 1000, now: 1000 }).allowed, true);
});

test("uses source address and a non-reversible session hint", () => {
  const first = requestRateLimitIdentity(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1", cookie: "session=one" }));
  const second = requestRateLimitIdentity(new Headers({ "x-forwarded-for": "203.0.113.1", cookie: "session=two" }));
  assert.notEqual(first, second);
  assert.equal(first.includes("session=one"), false);
  assert.equal(requestIpIdentity(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })), "203.0.113.1");
});
