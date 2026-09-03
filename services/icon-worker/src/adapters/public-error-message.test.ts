import assert from "node:assert/strict";
import test from "node:test";
import { publicErrorMessage } from "./public-error-message";

test("public errors never echo provider payloads or compiled prompts", () => {
  const upstream = '400: {"prompt":"PRIVATE STYLE CONTRACT","api_key":"secret"}';
  for (const kind of ["generation", "edit", "dispatch"] as const) {
    const message = publicErrorMessage(kind);
    assert.notEqual(message, upstream);
    assert.doesNotMatch(message, /PRIVATE STYLE CONTRACT|secret|prompt|api.?key/i);
  }
});
