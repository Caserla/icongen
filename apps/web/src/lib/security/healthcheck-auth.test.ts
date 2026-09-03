import assert from "node:assert/strict";
import test from "node:test";
import { healthcheckAuthorized } from "./healthcheck-auth";

const token = "readiness-token-with-32-characters";

test("readiness auth requires a sufficiently long exact token", () => {
  assert.equal(healthcheckAuthorized(token, token), true);
  assert.equal(healthcheckAuthorized("wrong-token", token), false);
  assert.equal(healthcheckAuthorized(null, token), false);
  assert.equal(healthcheckAuthorized("short", "short"), false);
});
