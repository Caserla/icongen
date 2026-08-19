import type { AppLogger, AssetStore, GenerationRepository, ImageProvider, PromptCompiler } from "./ports";

export type ProcessGenerationJobDependencies = {
  repository: GenerationRepository;
  imageProvider: ImageProvider;
  assetStore: AssetStore;
  promptCompiler: PromptCompiler;
  logger: AppLogger;
};

export async function processGenerationJob(jobId: string, dependencies: ProcessGenerationJobDependencies) {
  const job = await dependencies.repository.getJob(jobId);
  if (!job) throw new Error(`Generation job ${jobId} was not found`);

  if (job.status === "completed") {
    dependencies.logger.info("Generation job is already complete", { jobId });
    return;
  }

  if (job.status === "failed") throw new Error(`Generation job ${jobId} is already failed`);

  await dependencies.repository.markProcessing(jobId);

  for (const slot of [1, 2, 3, 4] as const) {
    const compiled = dependencies.promptCompiler.compile({
      description: job.description,
      stylePreset: job.stylePreset,
      slot,
    });
    const image = await dependencies.imageProvider.generate({ prompt: compiled.prompt });
    const asset = await dependencies.assetStore.put({
      jobId,
      slot,
      bytes: image.bytes,
      mimeType: image.mimeType,
    });

    await dependencies.repository.saveResult({
      jobId,
      slot,
      bucket: asset.bucket,
      objectPath: asset.objectPath,
      prompt: compiled.prompt,
      providerRequestId: image.providerRequestId,
    });
  }

  await dependencies.repository.markCompleted(jobId);
  dependencies.logger.info("Generation job completed", { jobId, resultCount: 4 });
}
