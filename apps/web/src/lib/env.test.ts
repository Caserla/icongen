import assert from "node:assert/strict";
import test from "node:test";
import { isPublicSignupEnabled } from "./env";

test(
  "public sign-up honors an explicit environment switch",
  { concurrency: false },
  () => {
    const previous = process.env.PUBLIC_SIGNUP_ENABLED;
    process.env.PUBLIC_SIGNUP_ENABLED = "false";
    assert.equal(isPublicSignupEnabled(), false);
    process.env.PUBLIC_SIGNUP_ENABLED = "true";
    assert.equal(isPublicSignupEnabled(), true);
    if (previous === undefined) delete process.env.PUBLIC_SIGNUP_ENABLED;
    else process.env.PUBLIC_SIGNUP_ENABLED = previous;
  },
);
