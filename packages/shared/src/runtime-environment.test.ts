import assert from "node:assert/strict";
import test from "node:test";
import { isIndexableEnvironment, resolveRuntimeEnvironment, validateRuntimeEnvironment } from "./runtime-environment";

test("resolves all four explicit environments", () => {
  for (const environment of ["development", "test", "preproduction", "production"] as const) {
    assert.equal(resolveRuntimeEnvironment({ appEnvironment: environment }), environment);
  }
});

test("only development and test may be inferred from NODE_ENV", () => {
  assert.equal(resolveRuntimeEnvironment({ nodeEnvironment: "development" }), "development");
  assert.equal(resolveRuntimeEnvironment({ nodeEnvironment: "test" }), "test");
  assert.throws(() => resolveRuntimeEnvironment({ nodeEnvironment: "production" }), /APP_ENV/);
});

test("rejects cross-environment resource bindings", () => {
  assert.throws(() => validateRuntimeEnvironment({
    appEnvironment: "preproduction",
    resourceEnvironment: "production",
    appUrl: "https://staging.example.com",
  }), /does not match/);
});

test("requires public environments to use non-local HTTPS URLs", () => {
  assert.throws(() => validateRuntimeEnvironment({ appEnvironment: "preproduction", appUrl: "http://example.com" }), /HTTPS/);
  assert.throws(() => validateRuntimeEnvironment({ appEnvironment: "production", appUrl: "https://localhost" }), /localhost/);
});

test("production is the only indexable environment and cannot use mock generation", () => {
  assert.equal(isIndexableEnvironment("preproduction"), false);
  assert.equal(isIndexableEnvironment("production"), true);
  assert.throws(() => validateRuntimeEnvironment({ appEnvironment: "production", imageProvider: "mock" }), /mock/);
});
