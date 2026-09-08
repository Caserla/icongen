import assert from "node:assert/strict";
import test from "node:test";
import { generationRuntimeLimitError } from "./generation-create-error";

for (const [databaseMessage, code, status] of [
  ["GENERATION_GLOBAL_CONCURRENCY_LIMIT", "GENERATION_CAPACITY_REACHED", 503],
  ["GENERATION_GLOBAL_DAILY_LIMIT", "GENERATION_BUDGET_PAUSED", 503],
  ["GENERATION_GLOBAL_MONTHLY_LIMIT", "GENERATION_BUDGET_PAUSED", 503],
  ["GENERATION_USER_DAILY_LIMIT", "GENERATION_DAILY_LIMIT_REACHED", 429],
] as const) {
  test(`maps ${databaseMessage} to a stable public response`, () => {
    const result = generationRuntimeLimitError(
      `database error: ${databaseMessage}`,
    );
    assert.equal(result?.code, code);
    assert.equal(result?.status, status);
  });
}

test("does not classify unrelated database failures", () => {
  assert.equal(generationRuntimeLimitError("connection closed"), null);
});
