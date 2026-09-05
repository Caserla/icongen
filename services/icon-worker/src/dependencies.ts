import { createClient } from "@supabase/supabase-js";
import type { ProcessGenerationJobDependencies } from "@icongen/backend-core";
import { logger } from "./adapters/logger";
import { SupabaseAssetStore } from "./adapters/supabase-asset-store";
import { SupabaseGenerationRepository } from "./adapters/supabase-generation-repository";
import { SharpImageProcessor } from "./adapters/sharp-image-processor";
import { SharpImageQualityGate } from "./adapters/sharp-image-quality-gate";
import { VTracerVectorImageProcessor } from "./adapters/vtracer-vector-image-processor";
import type { WorkerConfig } from "./config";
import { createImageProvider, createPromptCompiler } from "./registries";

export function createWorkerSupabaseClient(config: WorkerConfig) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createDependencies(
  config: WorkerConfig,
  workerId = process.env.WORKER_INSTANCE_ID,
): ProcessGenerationJobDependencies {
  const supabase = createWorkerSupabaseClient(config);

  return {
    repository: new SupabaseGenerationRepository(supabase, workerId),
    assetStore: new SupabaseAssetStore(supabase, config.SUPABASE_ICON_BUCKET),
    imageProvider: createImageProvider(config),
    imageProcessor: new SharpImageProcessor(),
    vectorImageProcessor: new VTracerVectorImageProcessor(),
    imageQualityGate: new SharpImageQualityGate(),
    promptCompiler: createPromptCompiler(config.ICON_SKILL),
    logger,
    generationConcurrency: config.GENERATION_CONCURRENCY,
  };
}
