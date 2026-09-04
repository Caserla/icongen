import assert from "node:assert/strict";
import test from "node:test";
import { checkMutationRequest, MAX_API_BODY_BYTES } from "./mutation-request";

function check(headers: Record<string, string>, method = "POST", pathname = "/api/generation/jobs") {
  return checkMutationRequest({ pathname, method, protocol: "https:", headers: new Headers(headers) });
}

test("allows same-origin JSON mutations", () => {
  assert.deepEqual(check({ origin: "https://icons.example", host: "icons.example", "content-type": "application/json", "content-length": "20", "sec-fetch-site": "same-origin" }), { allowed: true });
});

test("rejects cross-origin and missing-origin mutations", () => {
  assert.equal(check({ origin: "https://evil.example", host: "icons.example", "content-length": "0" }).allowed, false);
  assert.equal(check({ host: "icons.example", "content-length": "0" }).allowed, false);
});

test("rejects oversized and non-JSON mutation bodies", () => {
  const oversized = check({ origin: "https://icons.example", host: "icons.example", "content-length": String(MAX_API_BODY_BYTES + 1), "content-type": "application/json" });
  assert.equal(oversized.allowed ? 0 : oversized.status, 413);
  const wrongType = check({ origin: "https://icons.example", host: "icons.example", "content-length": "2", "content-type": "text/plain" });
  assert.equal(wrongType.allowed ? 0 : wrongType.status, 415);
});

test("does not apply browser-origin checks to read requests", () => {
  assert.deepEqual(check({}, "GET"), { allowed: true });
});
