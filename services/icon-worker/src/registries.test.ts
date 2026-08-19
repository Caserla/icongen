import assert from "node:assert/strict";
import test from "node:test";
import { createPromptCompiler } from "./registries";

test("selects the configured icon skill", () => {
  const compiler = createPromptCompiler("default-icon");
  assert.equal(compiler.name, "default-icon");
  assert.equal(compiler.version, "0.1.0");
});

test("rejects an unregistered icon skill", () => {
  assert.throws(() => createPromptCompiler("missing-skill"), /Unsupported ICON_SKILL/);
});

