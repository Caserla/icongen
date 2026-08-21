import type { ImageProvider, PromptCompiler } from "@icongen/backend-core";
import { iconSkillPromptCompiler } from "./adapters/icon-skill-prompt-compiler";
import { MockImageProvider } from "./adapters/mock-image-provider";
import { OpenAIImageProvider } from "./adapters/openai-image-provider";
import type { WorkerConfig } from "./config";

const promptCompilerRegistry: Record<string, PromptCompiler> = {
  [iconSkillPromptCompiler.name]: iconSkillPromptCompiler,
};

export function createPromptCompiler(name: string): PromptCompiler {
  const compiler = promptCompilerRegistry[name];
  if (!compiler) throw new Error(`Unsupported ICON_SKILL: ${name}`);
  return compiler;
}

export function createImageProvider(config: WorkerConfig): ImageProvider {
  switch (config.IMAGE_PROVIDER) {
    case "mock":
      return new MockImageProvider();
    case "openai":
      if (!config.IMAGE_PROVIDER_API_KEY) throw new Error("IMAGE_PROVIDER_API_KEY is required for OpenAI");
      return new OpenAIImageProvider(config.IMAGE_PROVIDER_API_KEY, config.IMAGE_MODEL, config.IMAGE_QUALITY);
    default:
      throw new Error(`Unsupported IMAGE_PROVIDER: ${config.IMAGE_PROVIDER}`);
  }
}
