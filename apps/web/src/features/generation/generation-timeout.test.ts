import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERATION_STALL_WARNING_MS,
  hasRepeatedPollingFailures,
  isGenerationStalled,
} from "./generation-timeout";

const now = Date.parse("2026-09-03T13:00:00.000Z");

test("warns when active generation has no backend progress for five minutes", () => {
  assert.equal(
    isGenerationStalled(
      {
        status: "processing",
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: new Date(now - GENERATION_STALL_WARNING_MS).toISOString(),
      },
      now,
    ),
    true,
  );
});

test("does not warn for recent progress or a terminal job", () => {
  assert.equal(
    isGenerationStalled(
      {
        status: "processing",
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: new Date(now - 30_000).toISOString(),
      },
      now,
    ),
    false,
  );
  assert.equal(
    isGenerationStalled(
      {
        status: "failed",
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: "2026-09-03T12:01:00.000Z",
      },
      now,
    ),
    false,
  );
});

test("shows connection warning only after repeated polling failures", () => {
  assert.equal(hasRepeatedPollingFailures(2), false);
  assert.equal(hasRepeatedPollingFailures(3), true);
});
