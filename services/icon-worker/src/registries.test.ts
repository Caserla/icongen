import assert from "node:assert/strict";
import test from "node:test";
import { createImageProvider, createPromptCompiler } from "./registries";

test("selects the configured icon skill", () => {
  const compiler = createPromptCompiler("default-ui-icon");
  assert.equal(compiler.name, "default-ui-icon");
  assert.equal(compiler.version, "0.2.0");
});

test("rejects an unregistered icon skill", () => {
  assert.throws(() => createPromptCompiler("missing-skill"), /Unsupported ICON_SKILL/);
});

test("uses the mock provider without an API key", async () => {
  const provider = createImageProvider({
    IMAGE_PROVIDER: "mock",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_QUALITY: "medium",
    ICON_SKILL: "default-ui-icon",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    SUPABASE_ICON_BUCKET: "generated-icons",
    GENERATION_MAX_ATTEMPTS: 3,
  });
  const image = await provider.generate({ prompt: "test" });
  assert.equal(provider.name, "mock");
  assert.equal(image.mimeType, "image/png");
  assert.ok(image.bytes.length > 0);
});

test("creates an OpenAI-compatible provider with a custom base URL", () => {
  const provider = createImageProvider({
    IMAGE_PROVIDER: "openai",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_QUALITY: "medium",
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
