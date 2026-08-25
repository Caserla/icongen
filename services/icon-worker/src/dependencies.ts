import { createClient } from "@supabase/supabase-js";
import type { ProcessGenerationJobDependencies } from "@icongen/backend-core";
import { logger } from "./adapters/logger";
import { SupabaseAssetStore } from "./adapters/supabase-asset-store";
import { SupabaseGenerationRepository } from "./adapters/supabase-generation-repository";
import { SharpImageProcessor } from "./adapters/sharp-image-processor";
import { SharpImageQualityGate } from "./adapters/sharp-image-quality-gate";
import type { WorkerConfig } from "./config";
import { createImageProvider, createPromptCompiler } from "./registries";

export function createDependencies(config: WorkerConfig): ProcessGenerationJobDependencies {
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    repository: new SupabaseGenerationRepository(supabase),
    assetStore: new SupabaseAssetStore(supabase, config.SUPABASE_ICON_BUCKET),
    imageProvider: createImageProvider(config),
    imageProcessor: new SharpImageProcessor(),
    imageQualityGate: new SharpImageQualityGate(),
    promptCompiler: createPromptCompiler(config.ICON_SKILL),
    logger,
  };
}
