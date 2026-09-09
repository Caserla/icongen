import assert from "node:assert/strict";
import test from "node:test";
import { generateValidatedImage } from "./generate-validated-image";

test("transparent quality warnings do not invoke chroma cleanup or block delivery", async () => {
  const strategies: Array<string | undefined> = [];
  const prompts: string[] = [];
  let normalized = 0;
  let inspected = 0;
  const result = await generateValidatedImage(
    { jobId: "job", variantId: "variant", prompt: "filled bell", outputBackground: "transparent", purpose: "interaction" },
    {
      imageProvider: {
        name: "test",
        model: "test",
        async generate(input) {
          strategies.push(input.transparencyStrategy);
          prompts.push(input.prompt);
          assert.equal(input.background, "transparent");
          assert.equal(input.chromaColor, undefined);
          return { bytes: new Uint8Array([strategies.length]), mimeType: "image/png" };
        },
      },
      imageProcessor: {
        async inspect({ bytes }) {
          inspected += 1;
          return { width: 1024, height: 1024, hasAlpha: true, hasTransparency: bytes[0] > 1 };
        },
        async normalizeTransparentBackground({ bytes }) {
          normalized += 1;
          return { bytes, mimeType: "image/png", width: 1024, height: 1024, hasAlpha: true };
        },
        async process({ bytes, size }) {
          return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true };
        },
      },
      imageQualityGate: {
        async inspect({ bytes }) {
          return bytes[0] === 1
            ? [{ code: "OPAQUE_TRANSPARENT_CANVAS_EDGE", message: "opaque edge" }]
            : [];
        },
      },
      logger: { info() {}, error() {} },
    },
  );
  assert.deepEqual(strategies, ["native-alpha"]);
  assert.equal(prompts.length, 1);
  assert.doesNotMatch(prompts.join("\n"), /#00FF00|CHROMA KEY/);
  assert.equal(normalized, 0);
  assert.equal(inspected, 1);
  assert.equal(result.image.bytes[0], 1);
  assert.ok(result.qualityWarnings.some((warning) =>
    warning.code === "OPAQUE_TRANSPARENT_CANVAS_EDGE" || warning.code === "MISSING_ALPHA_CHANNEL"
  ));
});

test("unsupported transparency is reported without a conflicting chroma request", async () => {
  const strategies: Array<string | undefined> = [];
  let normalized = 0;
  await assert.rejects(generateValidatedImage(
    { jobId: "job", variantId: "variant", prompt: "filled bell", outputBackground: "transparent" },
    {
      imageProvider: {
        name: "test", model: "test",
        async generate(input) {
          strategies.push(input.transparencyStrategy);
          if (input.transparencyStrategy === "native-alpha") throw new Error("400 Transparent background is not supported for this model.");
          return { bytes: new Uint8Array([2]), mimeType: "image/png" };
        },
      },
      imageProcessor: {
        async inspect() { return { width: 1024, height: 1024, hasAlpha: true, hasTransparency: true }; },
        async normalizeTransparentBackground({ bytes }) { normalized += 1; return { bytes, mimeType: "image/png", width: 1024, height: 1024, hasAlpha: true }; },
        async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; },
      },
      imageQualityGate: { async inspect() { return []; } },
      logger: { info() {}, error() {} },
    },
  ), /Transparent background is not supported/);
  assert.deepEqual(strategies, ["native-alpha"]);
  assert.equal(normalized, 0);
});

test("opaque and painted-checkerboard results are returned with non-blocking warnings", async () => {
  for (const paintedCheckerboard of [false, true]) {
    let attempts = 0;
    const result = await generateValidatedImage(
      { jobId: "job", variantId: "variant", prompt: "coffee kiosk", outputBackground: "transparent" },
      {
        imageProvider: {
          name: "test", model: "test",
          async generate(input) {
            attempts += 1;
            assert.equal(input.transparencyStrategy, "native-alpha");
            return { bytes: new Uint8Array([1]), mimeType: "image/png" };
          },
        },
        imageProcessor: {
          async inspect() { return { width: 1024, height: 1024, hasAlpha: true, hasTransparency: paintedCheckerboard }; },
          async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; },
        },
        imageQualityGate: { async inspect() {
          return paintedCheckerboard ? [{ code: "FAKE_TRANSPARENCY_CHECKERBOARD" as const, message: "painted grid" }] : [];
        } },
        logger: { info() {}, error() {} },
      },
    );
    assert.equal(attempts, 1);
    assert.ok(result.qualityWarnings.some((warning) =>
      warning.code === (paintedCheckerboard ? "FAKE_TRANSPARENCY_CHECKERBOARD" : "MISSING_ALPHA_CHANNEL")
    ));
  }
});

test("non-square source is blocked only for square and rounded-square backgrounds", async () => {
  const dependencies = {
    imageProvider: {
      name: "test", model: "test",
      async generate() { return { bytes: new Uint8Array([1]), mimeType: "image/png" as const }; },
    },
    imageProcessor: {
      async inspect() { return { width: 1200, height: 900, hasAlpha: true, hasTransparency: true }; },
      async process({ bytes, size }: { bytes: Uint8Array; size: number }) { return { bytes, mimeType: "image/png" as const, width: size, height: size, hasAlpha: true }; },
    },
    imageQualityGate: { async inspect() { return [{ code: "SOURCE_NOT_SQUARE" as const, message: "1200x900" }]; } },
    logger: { info() {}, error() {} },
  };
  const transparent = await generateValidatedImage(
    { jobId: "job", variantId: "transparent", prompt: "subject", outputBackground: "transparent" },
    dependencies,
  );
  assert.equal(transparent.image.bytes[0], 1);
  const circle = await generateValidatedImage(
    { jobId: "job", variantId: "circle", prompt: "subject", outputBackground: "opaque", backgroundContainer: "circle" },
    dependencies,
  );
  assert.equal(circle.image.bytes[0], 1);
  await assert.rejects(generateValidatedImage(
    { jobId: "job", variantId: "rounded", prompt: "subject", outputBackground: "opaque", backgroundContainer: "rounded-square" },
    dependencies,
  ), /not a square production asset/);
  await assert.rejects(generateValidatedImage(
    { jobId: "job", variantId: "square", prompt: "subject", outputBackground: "opaque", backgroundContainer: "square" },
    dependencies,
  ), /not a square production asset/);
});

test("unrelated provider errors are not hidden behind the transparency fallback", async () => {
  await assert.rejects(
    generateValidatedImage(
      { jobId: "job", variantId: "variant", prompt: "bell", outputBackground: "transparent" },
      {
        imageProvider: { name: "test", model: "test", async generate() { throw new Error("429 quota exceeded"); } },
        imageProcessor: {
          async inspect() { return { width: 1, height: 1, hasAlpha: true }; },
          async process({ bytes, size }) { return { bytes, mimeType: "image/png", width: size, height: size, hasAlpha: true }; },
        },
        logger: { info() {}, error() {} },
      },
    ),
    /429 quota exceeded/,
  );
});
