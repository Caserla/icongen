import assert from "node:assert/strict";
import test from "node:test";
import { generateValidatedImage } from "./generate-validated-image";

test("transparent generation falls back from native alpha to chroma key and normalizes the result", async () => {
  const strategies: Array<string | undefined> = [];
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
  assert.deepEqual(strategies, ["native-alpha", "chroma-key"]);
  assert.equal(normalized, 1);
  assert.equal(inspected, 2);
  assert.equal(result.image.bytes[0], 2);
});

test("transparent generation immediately uses chroma key when the provider rejects native alpha", async () => {
  const strategies: Array<string | undefined> = [];
  let normalized = 0;
  await generateValidatedImage(
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
  );
  assert.deepEqual(strategies, ["native-alpha", "chroma-key"]);
  assert.equal(normalized, 1);
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
