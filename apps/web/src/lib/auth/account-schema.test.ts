import assert from "node:assert/strict";
import test from "node:test";
import { signUpSchema, updateProfileSchema } from "@icongen/shared";

test("normalizes registration email and requires accepted terms", () => {
  const parsed = signUpSchema.parse({
    email: " USER@Example.com ",
    password: "password1",
    acceptedTerms: true,
  });
  assert.equal(parsed.email, "user@example.com");
  assert.equal(
    signUpSchema.safeParse({
      email: "user@example.com",
      password: "password1",
      acceptedTerms: false,
    }).success,
    false,
  );
});

test("validates profile inputs", () => {
  assert.equal(
    updateProfileSchema.safeParse({ displayName: "A".repeat(18) }).success,
    true,
  );
  assert.equal(
    updateProfileSchema.safeParse({ displayName: "Trance S2" }).success,
    true,
  );
  assert.equal(
    updateProfileSchema.safeParse({ displayName: "竹子图标 2" }).success,
    true,
  );
  assert.equal(
    updateProfileSchema.safeParse({ displayName: "A".repeat(19) }).success,
    false,
  );
  assert.equal(
    updateProfileSchema.safeParse({ displayName: "Invalid@Name" }).success,
    false,
  );
  assert.equal(
    updateProfileSchema.safeParse({ displayName: "Name<script>" }).success,
    false,
  );
});
