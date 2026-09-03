import assert from "node:assert/strict";
import test from "node:test";
import { redactLogValue } from "./log-redaction";

test("redacts secret fields and signed query values", () => {
  assert.deepEqual(redactLogValue({ apiKey: "secret", prompt: "private subject", url: "https://x.test/a?token=abc&x=1" }), {
    apiKey: "[REDACTED]",
    prompt: "[REDACTED]",
    url: "https://x.test/a?token=[REDACTED]&x=1",
  });
});

test("redacts bearer credentials embedded in provider errors", () => {
  assert.equal(redactLogValue("request failed: Bearer abc.def"), "request failed: Bearer [REDACTED]");
});

test("redacts secrets embedded in provider error strings", () => {
  const result = String(
    redactLogValue('request failed: {"prompt":"private style contract with spaces","api_key":"sk-secret"}'),
  );
  assert.doesNotMatch(result, /private style contract|sk-secret/);
  assert.match(result, /\[REDACTED\]/);
});
