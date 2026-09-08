import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "./safe-next";

test("accepts an internal path with query parameters", () => {
  assert.equal(
    safeNextPath("/icons/job-1?tab=results"),
    "/icons/job-1?tab=results",
  );
});

test("rejects external and protocol-relative redirects", () => {
  assert.equal(safeNextPath("https://example.com/steal"), "/create");
  assert.equal(safeNextPath("//example.com/steal"), "/create");
});
