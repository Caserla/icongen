import { createClient } from "@supabase/supabase-js";
import type { ProcessGenerationJobDependencies } from "@icongen/backend-core";
import { iconSkillPromptCompiler } from "./adapters/icon-skill-prompt-compiler";
import { logger } from "./adapters/logger";
import { OpenAIImageProvider } from "./adapters/openai-image-provider";
import { SupabaseAssetStore } from "./adapters/supabase-asset-store";
import { SupabaseGenerationRepository } from "./adapters/supabase-generation-repository";
import type { WorkerConfig } from "./config";

export function createDependencies(config: WorkerConfig): ProcessGenerationJobDependencies {
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    repository: new SupabaseGenerationRepository(supabase),
    assetStore: new SupabaseAssetStore(supabase, config.SUPABASE_ICON_BUCKET),
    imageProvider: new OpenAIImageProvider(config.OPENAI_API_KEY, config.OPENAI_IMAGE_MODEL),
    promptCompiler: iconSkillPromptCompiler,
    logger,
  };
}
