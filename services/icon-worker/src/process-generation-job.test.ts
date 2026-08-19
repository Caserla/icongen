import assert from "node:assert/strict";
import test from "node:test";
import { processGenerationJob, type ProcessGenerationJobDependencies } from "@icongen/backend-core";

test("generates and saves exactly four icon results", async () => {
  const savedSlots: number[] = [];
  let completed = false;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() {
        return { id: "job-1", userId: "user-1", description: "A calm focus timer", status: "queued" };
      },
      async markProcessing() {},
      async saveResult(input) { savedSlots.push(input.slot); },
      async markCompleted() { completed = true; },
      async markFailedAndRefund() {},
    },
    imageProvider: {
      async generate() { return { bytes: new Uint8Array([1]), mimeType: "image/png" }; },
    },
    assetStore: {
      async put(input) { return { bucket: "icons", objectPath: `${input.jobId}/${input.slot}.png` }; },
    },
    promptCompiler: {
      compile(input) { return { prompt: `slot-${input.slot}`, skillVersion: "test" }; },
    },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.deepEqual(savedSlots, [1, 2, 3, 4]);
  assert.equal(completed, true);
});

test("does not regenerate a completed job", async () => {
  let providerCalls = 0;
  const dependencies = {
    repository: {
      async getJob() { return { id: "job-1", userId: "user-1", description: "Done", status: "completed" as const }; },
      async markProcessing() {}, async saveResult() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { async generate() { providerCalls += 1; return { bytes: new Uint8Array(), mimeType: "image/png" as const }; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "unused" }; } },
    promptCompiler: { compile() { return { prompt: "unused", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  } satisfies ProcessGenerationJobDependencies;

  await processGenerationJob("job-1", dependencies);
  assert.equal(providerCalls, 0);
});
