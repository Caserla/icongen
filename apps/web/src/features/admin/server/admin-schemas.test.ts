import assert from "node:assert/strict";
import test from "node:test";
import {
  adminListSchema,
  createCdKeyBatchSchema,
  disableCdKeyBatchSchema,
} from "./admin-schemas";

test("CD-Key batches enforce safe production bounds", () => {
  assert.equal(
    createCdKeyBatchSchema.safeParse({
      name: "Launch",
      credits: 20,
      count: 500,
      expiresAt: null,
    }).success,
    true,
  );
  assert.equal(
    createCdKeyBatchSchema.safeParse({
      name: "Launch",
      credits: 20,
      count: 501,
      expiresAt: null,
    }).success,
    false,
  );
  assert.equal(
    createCdKeyBatchSchema.safeParse({
      name: "",
      credits: 0,
      count: 0,
      expiresAt: null,
    }).success,
    false,
  );
});

test("disabling a batch requires an audit reason", () => {
  assert.equal(
    disableCdKeyBatchSchema.safeParse({ reason: "campaign cancelled" }).success,
    true,
  );
  assert.equal(
    disableCdKeyBatchSchema.safeParse({ reason: "" }).success,
    false,
  );
});

test("admin list inputs are bounded", () => {
  assert.deepEqual(adminListSchema.parse({}), {
    page: 1,
    query: "",
    status: "all",
  });
  assert.equal(adminListSchema.safeParse({ page: 0 }).success, false);
});
