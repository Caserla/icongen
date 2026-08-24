import assert from "node:assert/strict";
import test from "node:test";
import { processGenerationJob, type GenerationJobRecord, type ProcessGenerationJobDependencies } from "@icongen/backend-core";
import { DESIGN_SETTINGS_VERSION } from "@icongen/shared";

const spec: GenerationJobRecord["spec"] = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  settingsVersion: DESIGN_SETTINGS_VERSION,
  purpose: "app-icon",
  subjects: [
    { clientId: "add", name: "Add", description: "Add a new item" },
    { clientId: "search", name: "Search", description: "Find an existing item" },
  ],
  subjectColor: { mode: "solid", color: "#6750E8" },
  background: { enabled: false },
  style: { preset: "clay-3d", strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "standard" },
  sizes: [24],
};

function job(status: GenerationJobRecord["status"] = "queued"): GenerationJobRecord {
  return {
    id: "job-1", userId: "user-1", status, spec,
    subjects: spec.subjects.map((subject, subjectIndex) => ({
      id: `subject-${subjectIndex + 1}`, clientId: subject.clientId, name: subject.name,
      description: subject.description, position: subjectIndex, colorOverride: subject.colorOverride,
      variants: ([1, 2, 3] as const).map((slot) => ({ id: `variant-${subjectIndex + 1}-${slot}`, subjectId: `subject-${subjectIndex + 1}`, slot, status: "queued" })),
    })),
  };
}

test("generates exactly three variants for every subject", async () => {
  const completedVariants: string[] = [];
  const purposes: Array<string | undefined> = [];
  let completed = false;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job(); }, async markProcessing() {}, async markVariantProcessing() {},
      async saveAsset() {}, async markVariantCompleted(input) { completedVariants.push(input.variantId); },
      async updateProgress() {}, async markCompleted() { completed = true; }, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() { return { bytes: new Uint8Array([1]), mimeType: "image/png" }; } },
    imageProcessor: { async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    assetStore: { async put(input) { return { bucket: "icons", objectPath: `${input.jobId}/${input.subjectId}/${input.slot}/${input.size}.png` }; } },
    promptCompiler: { name: "test-skill", version: "test", compile(input) { purposes.push(input.purpose); return { prompt: `${input.name}-${input.slot}`, skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.equal(completedVariants.length, 6);
  assert.equal(new Set(completedVariants).size, 6);
  assert.equal(completed, true);
  assert.deepEqual(new Set(purposes), new Set(["app-icon"]));
});

test("does not regenerate a completed job", async () => {
  let providerCalls = 0;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job("completed"); }, async markProcessing() {}, async markVariantProcessing() {},
      async saveAsset() {}, async markVariantCompleted() {}, async updateProgress() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() { providerCalls += 1; return { bytes: new Uint8Array(), mimeType: "image/png" }; } },
    imageProcessor: { async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "unused" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "unused", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.equal(providerCalls, 0);
});
