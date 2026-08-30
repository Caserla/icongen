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
  sizes: [32],
};

function job(status: GenerationJobRecord["status"] = "queued", jobSpec: GenerationJobRecord["spec"] = spec): GenerationJobRecord {
  return {
    id: "job-1", userId: "user-1", status, spec: jobSpec,
    subjects: jobSpec.subjects.map((subject, subjectIndex) => ({
      id: `subject-${subjectIndex + 1}`, clientId: subject.clientId, name: subject.name,
      description: subject.description, position: subjectIndex, colorOverride: subject.colorOverride,
      variants: ([1, 2, 3] as const).map((slot) => ({ id: `variant-${subjectIndex + 1}-${slot}`, subjectId: `subject-${subjectIndex + 1}`, slot, status: "queued" })),
    })),
  };
}

test("creates SVG output only for supported icon tasks", async () => {
  const formats: string[] = [];
  const interactionSpec: GenerationJobRecord["spec"] = { ...spec, purpose: "interaction", style: { ...spec.style, graphicStructure: "linear" } };
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job("queued", interactionSpec); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed() {},
      async saveAsset(input) { formats.push(input.format); }, async markVariantCompleted() {}, async updateProgress() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() { return { bytes: new Uint8Array([1]), mimeType: "image/png" }; } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: true }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    vectorImageProcessor: { async process() { return { bytes: new Uint8Array([2]), mimeType: "image/svg+xml", width: 1024, height: 1024 }; } },
    assetStore: { async put(input) { return { bucket: "icons", objectPath: `output.${input.format}` }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "vector", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.equal(formats.filter((format) => format === "svg").length, 6);
});

test("generates exactly three variants for every subject", async () => {
  const completedVariants: string[] = [];
  const purposes: Array<string | undefined> = [];
  let completed = false;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job(); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed() {},
      async saveAsset() {}, async markVariantCompleted(input) { completedVariants.push(input.variantId); },
      async updateProgress() {}, async markCompleted() { completed = true; }, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() { return { bytes: new Uint8Array([1]), mimeType: "image/png" }; } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: true }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
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

test("runs up to three image generations in parallel", async () => {
  let active = 0;
  let maxActive = 0;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job(); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed() {},
      async saveAsset() {}, async markVariantCompleted() {}, async updateProgress() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() {
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { bytes: new Uint8Array([1]), mimeType: "image/png" };
    } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: true }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "parallel-test.png" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "parallel", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.equal(maxActive, 3);
});

test("starts different subjects before later variants of the first subject", async () => {
  const threeSubjectSpec: GenerationJobRecord["spec"] = {
    ...spec,
    subjects: [
      ...spec.subjects,
      { clientId: "favorite", name: "Favorite", description: "Save an item" },
    ],
  };
  const processingOrder: string[] = [];
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job("queued", threeSubjectSpec); }, async markProcessing() {},
      async markVariantProcessing(variantId) { processingOrder.push(variantId); },
      async markVariantFailed() {},
      async saveAsset() {}, async markVariantCompleted() {}, async updateProgress() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return { bytes: new Uint8Array([1]), mimeType: "image/png" };
    } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: true }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "round-robin-test.png" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "round-robin", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.deepEqual(processingOrder.slice(0, 3), ["variant-1-1", "variant-2-1", "variant-3-1"]);
});

test("waits for every parallel variant before reporting a partial failure", async () => {
  const completedVariants: string[] = [];
  const failedVariants: string[] = [];
  let providerCalls = 0;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job(); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed(input) { failedVariants.push(input.variantId); },
      async saveAsset() {}, async markVariantCompleted(input) { completedVariants.push(input.variantId); },
      async updateProgress() {}, async markCompleted() { assert.fail("a partially failed job must not be completed"); }, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() {
      providerCalls += 1;
      if (providerCalls === 1) throw new Error("provider rejected one variant");
      await new Promise((resolve) => setTimeout(resolve, 2));
      return { bytes: new Uint8Array([1]), mimeType: "image/png" };
    } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: false }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: false }; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "partial-test.png" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "partial", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await assert.rejects(processGenerationJob("job-1", dependencies), /provider rejected one variant/);
  assert.equal(providerCalls, 6);
  assert.equal(completedVariants.length, 5);
  assert.equal(failedVariants.length, 1);
});

test("does not regenerate a completed job", async () => {
  let providerCalls = 0;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job("completed"); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed() {},
      async saveAsset() {}, async markVariantCompleted() {}, async updateProgress() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() { providerCalls += 1; return { bytes: new Uint8Array(), mimeType: "image/png" }; } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: true }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "unused" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "unused", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.equal(providerCalls, 0);
});

test("does not deliver a generated image with a painted transparency checkerboard", async () => {
  let savedAssets = 0;
  let completedVariants = 0;
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job(); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed() {},
      async saveAsset() { savedAssets += 1; }, async markVariantCompleted() { completedVariants += 1; },
      async updateProgress() {}, async markCompleted() { assert.fail("a checkerboard result must not complete"); }, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate() { return { bytes: new Uint8Array([1]), mimeType: "image/png" }; } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: false }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: false }; } },
    imageQualityGate: { async inspect() { return [{ code: "FAKE_TRANSPARENCY_CHECKERBOARD", message: "painted checkerboard" }]; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "must-not-save.png" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "clean positive template", skillVersion: "test" }; } },
    logger: { info() {}, error() {} },
  };

  await assert.rejects(processGenerationJob("job-1", dependencies), /painted transparency checkerboard/);
  assert.equal(savedAssets, 0);
  assert.equal(completedVariants, 0);
});

test("retries blocking quality warnings and delivers the next valid image", async () => {
  const oneSubjectSpec: GenerationJobRecord["spec"] = { ...spec, subjects: [spec.subjects[0]], style: { ...spec.style, preset: "flat-playful" } };
  let providerCalls = 0;
  let completedVariants = 0;
  const providerInputs: Array<{ prompt: string; background?: "transparent" | "opaque" | "auto" }> = [];
  const dependencies: ProcessGenerationJobDependencies = {
    repository: {
      async getJob() { return job("queued", oneSubjectSpec); }, async markProcessing() {}, async markVariantProcessing() {}, async markVariantFailed() {},
      async saveAsset() {}, async markVariantCompleted() { completedVariants += 1; },
      async updateProgress() {}, async markCompleted() {}, async markFailedAndRefund() {},
    },
    imageProvider: { name: "test-provider", model: "test-model", async generate(input) { providerInputs.push(input); providerCalls += 1; return { bytes: new Uint8Array([providerCalls]), mimeType: "image/png" }; } },
    imageProcessor: { async inspect() { return { width: 1024, height: 1024, hasAlpha: true }; }, async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; } },
    imageQualityGate: { async inspect({ bytes }) { return bytes[0] <= 3 ? [{ code: "NON_UNIFORM_SOLID_BACKGROUND", message: "uneven" }] : []; } },
    assetStore: { async put() { return { bucket: "icons", objectPath: "quality-retry.png" }; } },
    promptCompiler: { name: "test-skill", version: "test", compile() { return { prompt: "uniform flat background", skillVersion: "test", outputBackground: "opaque" }; } },
    logger: { info() {}, error() {} },
  };

  await processGenerationJob("job-1", dependencies);
  assert.equal(providerCalls, 6);
  assert.equal(completedVariants, 3);
  assert.ok(providerInputs.every((input) => input.background === "opaque"));
  assert.ok(providerInputs.some((input) => input.prompt.includes("MANDATORY RETRY REPAIR")));
  assert.ok(providerInputs.some((input) => input.prompt.includes("uneven")));
});
