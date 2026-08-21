import type { AppLogger, AssetStore, GenerationRepository, ImageProcessor, ImageProvider, PromptCompiler } from "./ports";

export type ProcessGenerationJobDependencies = {
  repository: GenerationRepository;
  imageProvider: ImageProvider;
  imageProcessor: ImageProcessor;
  assetStore: AssetStore;
  promptCompiler: PromptCompiler;
  logger: AppLogger;
};

export async function processGenerationJob(jobId: string, dependencies: ProcessGenerationJobDependencies) {
  const job = await dependencies.repository.getJob(jobId);
  if (!job) throw new Error(`Generation job ${jobId} was not found`);

  if (job.status === "completed" || job.status === "partial") {
    dependencies.logger.info("Generation job is already complete", { jobId });
    return;
  }

  if (job.status === "failed") throw new Error(`Generation job ${jobId} is already failed`);

  const execution = {
    skillName: dependencies.promptCompiler.name,
    skillVersion: dependencies.promptCompiler.version,
    imageProvider: dependencies.imageProvider.name,
    imageModel: dependencies.imageProvider.model,
  };

  await dependencies.repository.markProcessing(jobId, execution);

  const variants = job.subjects.flatMap((subject) => subject.variants.map((variant) => ({ subject, variant })));
  const totalUnits = variants.length;
  let completedUnits = variants.filter(({ variant }) => variant.status === "completed").length;

  for (const { subject, variant } of variants) {
    if (variant.status === "completed") continue;
    await dependencies.repository.markVariantProcessing(variant.id);
    const compiled = dependencies.promptCompiler.compile({
      name: subject.name,
      description: subject.description,
      color: subject.colorOverride ?? job.spec.subjectColor,
      background: job.spec.background,
      coreSettings: job.spec.coreSettings,
      sizes: job.spec.sizes,
      slot: variant.slot,
    });
    const image = await dependencies.imageProvider.generate({ prompt: compiled.prompt });
    for (const size of job.spec.sizes) {
      const processed = await dependencies.imageProcessor.process({ bytes: image.bytes, size });
      if (!job.spec.background.enabled && !processed.hasAlpha) throw new Error(`Generated icon ${variant.id} is missing an alpha channel`);
      const asset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, size, bytes: processed.bytes, mimeType: processed.mimeType });
      await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, size, width: processed.width, height: processed.height, hasAlpha: processed.hasAlpha, bucket: asset.bucket, objectPath: asset.objectPath });
    }
    await dependencies.repository.markVariantCompleted({ variantId: variant.id, prompt: compiled.prompt, ...execution, providerRequestId: image.providerRequestId });
    completedUnits += 1;
    await dependencies.repository.updateProgress(jobId, completedUnits, totalUnits);
  }

  await dependencies.repository.markCompleted(jobId);
  dependencies.logger.info("Generation job completed", { jobId, subjectCount: job.subjects.length, variantCount: totalUnits });
}
