import assert from "node:assert/strict";
import test from "node:test";
import { validateSignUp } from "./validate-sign-up";

test("rejects invalid registration fields independently", () => {
  const errors = validateSignUp({ email: "bad", password: "short", passwordConfirmation: "different", acceptedTerms: false });
  assert.deepEqual(Object.keys(errors).sort(), ["acceptedTerms", "email", "password", "passwordConfirmation"]);
});

test("accepts a complete registration form", () => {
  assert.deepEqual(validateSignUp({ email: "user@example.com", password: "password1", passwordConfirmation: "password1", acceptedTerms: true }), {});
});

test("returns Chinese registration validation messages for the Chinese locale", () => {
  const errors = validateSignUp({ email: "bad", password: "short", passwordConfirmation: "different", acceptedTerms: false }, "zh");
  assert.equal(errors.email, "请输入有效的邮箱地址。");
  assert.equal(errors.passwordConfirmation, "两次输入的密码不一致。");
  assert.equal(errors.acceptedTerms, "请同意服务条款和隐私政策后继续。");
});
