import assert from "node:assert/strict";
import test from "node:test";
import { deleteAccountRequestSchema, signUpSchema, updateProfileSchema } from "@icongen/shared";

test("normalizes registration email and requires accepted terms", () => {
  const parsed = signUpSchema.parse({ email: " USER@Example.com ", password: "password1", acceptedTerms: true });
  assert.equal(parsed.email, "user@example.com");
  assert.equal(signUpSchema.safeParse({ email: "user@example.com", password: "password1", acceptedTerms: false }).success, false);
});

test("validates profile and deletion inputs", () => {
  assert.equal(updateProfileSchema.safeParse({ displayName: "A".repeat(18) }).success, true);
  assert.equal(updateProfileSchema.safeParse({ displayName: "A".repeat(19) }).success, false);
  assert.equal(deleteAccountRequestSchema.safeParse({ confirmation: "delete", password: "password1", idempotencyKey: crypto.randomUUID() }).success, false);
});
