import type { AppLogger, AssetStore, GenerationRepository, ImageProcessor, ImageProvider, PromptCompiler } from "./ports";

export type ProcessGenerationJobDependencies = {
  repository: GenerationRepository;
  imageProvider: ImageProvider;
  imageProcessor: ImageProcessor;
  assetStore: AssetStore;
  promptCompiler: PromptCompiler;
  logger: AppLogger;
};

const GENERATION_CONCURRENCY = 3;

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

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
  let progressUpdate = Promise.resolve();

  await runWithConcurrency(variants.filter(({ variant }) => variant.status !== "completed"), GENERATION_CONCURRENCY, async ({ subject, variant }) => {
    await dependencies.repository.markVariantProcessing(variant.id);
    const compiled = dependencies.promptCompiler.compile({
      purpose: job.spec.purpose,
      name: subject.name,
      description: subject.description,
      color: subject.colorOverride ?? job.spec.subjectColor,
      background: job.spec.background,
      style: job.spec.style,
      sizes: job.spec.sizes,
      slot: variant.slot,
    });
    const image = await dependencies.imageProvider.generate({ prompt: compiled.prompt });
    const sourceMetadata = await dependencies.imageProcessor.inspect({ bytes: image.bytes });
    const sourceSize = Math.max(sourceMetadata.width, sourceMetadata.height);
    const sourceAsset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "source", size: sourceSize, bytes: image.bytes, mimeType: image.mimeType });
    await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "source", size: sourceSize, width: sourceMetadata.width, height: sourceMetadata.height, hasAlpha: sourceMetadata.hasAlpha, bucket: sourceAsset.bucket, objectPath: sourceAsset.objectPath });

    const preview = await dependencies.imageProcessor.process({ bytes: image.bytes, size: 512 });
    const previewAsset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "preview", size: 512, bytes: preview.bytes, mimeType: preview.mimeType });
    await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "preview", size: 512, width: preview.width, height: preview.height, hasAlpha: preview.hasAlpha, bucket: previewAsset.bucket, objectPath: previewAsset.objectPath });

    for (const size of job.spec.sizes) {
      const processed = await dependencies.imageProcessor.process({ bytes: image.bytes, size });
      if (!job.spec.background.enabled && !processed.hasAlpha) throw new Error(`Generated icon ${variant.id} is missing an alpha channel`);
      const asset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "output", size, bytes: processed.bytes, mimeType: processed.mimeType });
      await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "output", size, width: processed.width, height: processed.height, hasAlpha: processed.hasAlpha, bucket: asset.bucket, objectPath: asset.objectPath });
    }
    await dependencies.repository.markVariantCompleted({ variantId: variant.id, prompt: compiled.prompt, ...execution, providerRequestId: image.providerRequestId });
    completedUnits += 1;
    const currentCompletedUnits = completedUnits;
    progressUpdate = progressUpdate.then(() => dependencies.repository.updateProgress(jobId, currentCompletedUnits, totalUnits));
    await progressUpdate;
  });

  await dependencies.repository.markCompleted(jobId);
  dependencies.logger.info("Generation job completed", { jobId, subjectCount: job.subjects.length, variantCount: totalUnits });
}
