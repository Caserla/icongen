import type { AppLogger, AssetStore, GenerationJobRecord, GenerationRepository, ImageProcessor, ImageProvider, ImageQualityGate, PromptCompiler, VectorImageProcessor } from "./ports";

export type ProcessGenerationJobDependencies = {
  repository: GenerationRepository;
  imageProvider: ImageProvider;
  imageProcessor: ImageProcessor;
  vectorImageProcessor?: VectorImageProcessor;
  imageQualityGate?: ImageQualityGate;
  assetStore: AssetStore;
  promptCompiler: PromptCompiler;
  logger: AppLogger;
};

const GENERATION_CONCURRENCY = 3;
const QUALITY_RETRY_ATTEMPTS = 3;

function supportsSvg(job: GenerationJobRecord) {
  return job.spec.purpose === "interaction" || job.spec.style.preset === "minimal-logo";
}

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

  // Interleave subjects by variant slot so the concurrency pool starts work for
  // different subjects first. With a limit of three, A1/B1/C1 now start
  // together instead of A1/A2/A3 occupying every worker.
  const variants = ([1, 2, 3] as const).flatMap((slot) =>
    job.subjects.flatMap((subject) =>
      subject.variants
        .filter((variant) => variant.slot === slot)
        .map((variant) => ({ subject, variant })),
    ),
  );
  const totalUnits = variants.length;
  let completedUnits = variants.filter(({ variant }) => variant.status === "completed").length;
  let progressUpdate = Promise.resolve();
  const failures: Array<{ variantId: string; message: string }> = [];

  await runWithConcurrency(variants.filter(({ variant }) => variant.status === "queued" || variant.status === "processing"), GENERATION_CONCURRENCY, async ({ subject, variant }) => {
    try {
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
      let image: Awaited<ReturnType<ImageProvider["generate"]>> | undefined;
      let qualityWarnings: Awaited<ReturnType<ImageQualityGate["inspect"]>> = [];
      for (let qualityAttempt = 1; qualityAttempt <= QUALITY_RETRY_ATTEMPTS; qualityAttempt += 1) {
        const retryRepair = qualityAttempt === 1 || qualityWarnings.length === 0
          ? ""
          : `\n\nMANDATORY RETRY REPAIR\nThe previous attempt was rejected by automated production QA. Correct every issue below instead of repeating the same composition:\n${qualityWarnings.map((warning) => `- ${warning.message}`).join("\n")}\nReturn a newly rendered image that satisfies the original specification and these corrections exactly.`;
        image = await dependencies.imageProvider.generate({
          prompt: `${compiled.prompt}${retryRepair}`,
          background: compiled.outputBackground,
        });
        qualityWarnings = await dependencies.imageQualityGate?.inspect({ bytes: image.bytes, purpose: job.spec.purpose, stylePreset: job.spec.style.preset, backgroundContract: compiled.qualityContract }) ?? [];
        const checkerboard = qualityWarnings.some((warning) => warning.code === "FAKE_TRANSPARENCY_CHECKERBOARD");
        const nonUniformSolidBackground = qualityWarnings.some((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND");
        if (!checkerboard && !nonUniformSolidBackground) break;
        if (qualityAttempt < QUALITY_RETRY_ATTEMPTS) {
          dependencies.logger.info("Retrying generated image after a blocking quality warning", { jobId, variantId: variant.id, qualityAttempt, qualityWarningCodes: qualityWarnings.map((warning) => warning.code) });
          continue;
        }
        if (checkerboard) throw new Error(`Generated icon ${variant.id} contains a painted transparency checkerboard after ${QUALITY_RETRY_ATTEMPTS} attempts`);
        const diagnostics = qualityWarnings.filter((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND").map((warning) => warning.message).join(" ");
        throw new Error(`Generated icon ${variant.id} does not have the required uniform full-bleed solid background after ${QUALITY_RETRY_ATTEMPTS} attempts. ${diagnostics}`);
      }
      if (!image) throw new Error(`Generated icon ${variant.id} did not return an image`);
      const roundedAppIcon = job.spec.purpose === "app-icon" && job.spec.background.enabled && job.spec.background.container === "rounded-square" && dependencies.imageProcessor.applyRoundedMask
        ? await dependencies.imageProcessor.applyRoundedMask({ bytes: image.bytes, cornerRadiusPercent: job.spec.background.cornerRadius ?? 22 })
        : null;
      const sourceBytes = roundedAppIcon?.bytes ?? image.bytes;
      const sourceMetadata = roundedAppIcon ?? await dependencies.imageProcessor.inspect({ bytes: sourceBytes });
      for (const warning of qualityWarnings) dependencies.logger.info("Generated image quality warning", { jobId, variantId: variant.id, qualityWarningCode: warning.code, qualityWarning: warning.message });
      const sourceSize = Math.max(sourceMetadata.width, sourceMetadata.height);
      const sourceAsset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "source", format: "png", size: sourceSize, bytes: sourceBytes, mimeType: "image/png" });
      await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "source", format: "png", size: sourceSize, width: sourceMetadata.width, height: sourceMetadata.height, hasAlpha: sourceMetadata.hasAlpha, bucket: sourceAsset.bucket, objectPath: sourceAsset.objectPath });

      const resizeProfile = job.spec.style.preset === "pixel-art" ? "pixel-art" : "icon";
      const preview = await dependencies.imageProcessor.process({ bytes: sourceBytes, size: 512, profile: resizeProfile });
      const previewAsset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "preview", format: "png", size: 512, bytes: preview.bytes, mimeType: preview.mimeType });
      await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "preview", format: "png", size: 512, width: preview.width, height: preview.height, hasAlpha: preview.hasAlpha, bucket: previewAsset.bucket, objectPath: previewAsset.objectPath });

      for (const size of job.spec.sizes) {
        const processed = await dependencies.imageProcessor.process({ bytes: sourceBytes, size, profile: resizeProfile });
        if (job.spec.purpose !== "app-icon" && !job.spec.background.enabled && !processed.hasAlpha) throw new Error(`Generated icon ${variant.id} is missing an alpha channel`);
        const asset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "output", format: "png", size, bytes: processed.bytes, mimeType: processed.mimeType });
        await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "output", format: "png", size, width: processed.width, height: processed.height, hasAlpha: processed.hasAlpha, bucket: asset.bucket, objectPath: asset.objectPath });
      }
      if (supportsSvg(job) && dependencies.vectorImageProcessor) {
        const vector = await dependencies.vectorImageProcessor.process({ bytes: sourceBytes, mode: job.spec.style.graphicStructure === "linear" || job.spec.style.preset === "minimal-logo" ? "binary" : "color" });
        const asset = await dependencies.assetStore.put({ jobId, subjectId: subject.id, variantId: variant.id, slot: variant.slot, assetRole: "output", format: "svg", size: Math.max(vector.width, vector.height), bytes: vector.bytes, mimeType: vector.mimeType });
        await dependencies.repository.saveAsset({ jobId, subjectId: subject.id, variantId: variant.id, assetRole: "output", format: "svg", size: Math.max(vector.width, vector.height), width: vector.width, height: vector.height, hasAlpha: true, bucket: asset.bucket, objectPath: asset.objectPath });
      }
      await dependencies.repository.markVariantCompleted({ variantId: variant.id, prompt: compiled.prompt, ...execution, providerRequestId: image.providerRequestId });
      completedUnits += 1;
      const currentCompletedUnits = completedUnits;
      progressUpdate = progressUpdate.then(() => dependencies.repository.updateProgress(jobId, currentCompletedUnits, totalUnits));
      await progressUpdate;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown variant generation error";
      await dependencies.repository.markVariantFailed({ variantId: variant.id, errorCode: "VARIANT_GENERATION_FAILED", errorMessage: message });
      failures.push({ variantId: variant.id, message });
      dependencies.logger.error("Generation variant failed", { jobId, variantId: variant.id, error: message });
    }
  });

  if (failures.length > 0) throw new Error(failures.map((failure) => `${failure.variantId}: ${failure.message}`).join("; "));
  await dependencies.repository.markCompleted(jobId);
  dependencies.logger.info("Generation job completed", { jobId, subjectCount: job.subjects.length, variantCount: totalUnits });
}
