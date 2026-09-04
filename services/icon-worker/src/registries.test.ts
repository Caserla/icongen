import assert from "node:assert/strict";
import test from "node:test";
import { ICON_STYLE_PRESET_IDS } from "@icongen/shared";
import { createImageProvider, createPromptCompiler } from "./registries";

test("selects the configured icon skill", () => {
  const compiler = createPromptCompiler("default-ui-icon");
  assert.equal(compiler.name, "default-ui-icon");
  assert.equal(compiler.version, "0.10.0");
});

test("loads a real PNG reference image for every app illustration style", () => {
  const compiler = createPromptCompiler("default-ui-icon");
  for (const preset of ICON_STYLE_PRESET_IDS.filter(
    (candidate) => candidate !== "line-icon",
  )) {
    const compiled = compiler.compile({
      purpose: "app-icon",
      name: "测试主体",
      description: "一个清晰完整的测试主体",
      color: { mode: "solid", color: "#61666E" },
      background: {
        enabled: true,
        container: "rounded-square",
        color: { mode: "solid", color: "#FFFFFF" },
        cornerRadius: 18,
      },
      style: {
        preset,
        graphicStructure: "filled",
        subjectSizePercent: 70,
        linearStrokeWidthPercent: 3.5,
        subjectOpacityPercent: 100,
        strokeWeight: "regular",
        cornerStyle: "balanced",
        detailLevel: "standard",
      },
      sizes: [64, 128, 256],
      slot: 1,
    });
    assert.ok(compiled.referenceImage, `missing reference image for ${preset}`);
    assert.equal(compiled.referenceImage.mimeType, "image/png");
    assert.equal(
      Buffer.from(compiled.referenceImage.bytes).subarray(1, 4).toString("ascii"),
      "PNG",
    );
  }
});

test("rejects an unregistered icon skill", () => {
  assert.throws(
    () => createPromptCompiler("missing-skill"),
    /Unsupported ICON_SKILL/,
  );
});

test("uses the mock provider without an API key", async () => {
  const provider = createImageProvider({
    IMAGE_PROVIDER: "mock",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_QUALITY: "medium",
    IMAGE_SIZE: "2048x2048",
    ICON_SKILL: "default-ui-icon",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    SUPABASE_ICON_BUCKET: "generated-icons",
    GENERATION_MAX_ATTEMPTS: 3,
  });
  const image = await provider.generate({ mode: "generation", prompt: "test" });
  assert.equal(provider.name, "mock");
  assert.equal(image.mimeType, "image/png");
  assert.ok(image.bytes.length > 0);
});

test("creates an OpenAI-compatible provider with a custom base URL", () => {
  const provider = createImageProvider({
    IMAGE_PROVIDER: "openai",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_QUALITY: "medium",
    IMAGE_SIZE: "2048x2048",
    IMAGE_PROVIDER_BASE_URL: "https://gateway.example.com/v1",
    IMAGE_PROVIDER_API_KEY: "test-gateway-key",
    ICON_SKILL: "default-ui-icon",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    SUPABASE_ICON_BUCKET: "generated-icons",
    GENERATION_MAX_ATTEMPTS: 3,
  });

  assert.equal(provider.name, "openai");
  assert.equal(provider.model, "gpt-image-2");
});
