import assert from "node:assert/strict";
import test from "node:test";
import { latestVariantEditFailure } from "./latest-variant-edit-failure";

test("keeps the latest failed detail edit visible after returning to the page", () => {
  assert.deepEqual(
    latestVariantEditFailure({
      id: "revision-failed",
      status: "failed",
      error_code: "VARIANT_EDIT_FAILED",
      error_message: "No compatible image account is available.",
    }),
    {
      id: "revision-failed",
      errorCode: "VARIANT_EDIT_FAILED",
      message: "No compatible image account is available.",
    },
  );
});

test("does not report completed or active edits as failures", () => {
  for (const status of ["queued", "processing", "completed"]) {
    assert.equal(
      latestVariantEditFailure({
        id: `revision-${status}`,
        status,
        error_code: null,
        error_message: null,
      }),
      null,
    );
  }
});

test("does not present a user-discarded comparison as a generation failure", () => {
  for (const errorCode of ["VARIANT_EDIT_DISCARDED", "RESTORED_DURING_EDIT"]) {
    assert.equal(
      latestVariantEditFailure({
        id: `revision-${errorCode}`,
        status: "failed",
        error_code: errorCode,
        error_message: "User chose the original image.",
      }),
      null,
    );
  }
});
