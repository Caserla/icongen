import assert from "node:assert/strict";
import test from "node:test";
import { redactServerLogValue } from "./log-redaction";

test("server logs redact structured secrets and embedded credentials", () => {
  const redacted = redactServerLogValue({
    prompt: "private prompt",
    email: "person@example.com",
    nested: {
      url: "https://example.com/image.png?token=secret&x=1",
      message: "upstream Bearer abc.def and sk_abcdefghijklmnop",
      providerBody: '{"prompt":"private compiled prompt","token":"raw-token"}',
    },
  });
  const serialized = JSON.stringify(redacted);
  assert.doesNotMatch(serialized, /private prompt|private compiled|raw-token|person@example|secret&|abc\.def|sk_abcdefghijklmnop/);
  assert.match(serialized, /REDACTED/);
});
