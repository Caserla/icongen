import type { CreateGenerationJobInput, IconStyle } from "@icongen/shared";
import type {
  AppLogger,
  BackgroundQualityContract,
  GeneratedImage,
  ImageProcessor,
  ImageProvider,
  ImageQualityGate,
  ImageQualityWarning,
} from "./ports";

const QUALITY_RETRY_ATTEMPTS = 3;

type GenerateValidatedImageInput = {
  jobId: string;
  variantId: string;
  prompt: string;
  outputBackground?: "transparent" | "opaque";
  purpose?: CreateGenerationJobInput["purpose"];
  stylePreset?: IconStyle["preset"];
  qualityContract?: BackgroundQualityContract;
};

type GenerateValidatedImageDependencies = {
  imageProvider: ImageProvider;
  imageProcessor: ImageProcessor;
  imageQualityGate?: ImageQualityGate;
  logger: AppLogger;
};

function isBlockingWarning(warning: ImageQualityWarning) {
  return (
    warning.code === "FAKE_TRANSPARENCY_CHECKERBOARD" ||
    warning.code === "NON_UNIFORM_SOLID_BACKGROUND" ||
    warning.code === "MISSING_ALPHA_CHANNEL"
  );
}

function createTerminalQualityError(
  variantId: string,
  warnings: ImageQualityWarning[],
) {
  if (
    warnings.some(
      (warning) => warning.code === "FAKE_TRANSPARENCY_CHECKERBOARD",
    )
  )
    return new Error(
      `Generated icon ${variantId} contains a painted transparency checkerboard after ${QUALITY_RETRY_ATTEMPTS} attempts`,
    );
  if (
    warnings.some((warning) => warning.code === "MISSING_ALPHA_CHANNEL")
  )
    return new Error(
      `Generated icon ${variantId} is missing a real alpha channel after ${QUALITY_RETRY_ATTEMPTS} attempts`,
    );
  const diagnostics = warnings
    .filter((warning) => warning.code === "NON_UNIFORM_SOLID_BACKGROUND")
    .map((warning) => warning.message)
    .join(" ");
  return new Error(
    `Generated icon ${variantId} does not have the required uniform full-bleed solid background after ${QUALITY_RETRY_ATTEMPTS} attempts. ${diagnostics}`,
  );
}

export async function generateValidatedImage(
  input: GenerateValidatedImageInput,
  dependencies: GenerateValidatedImageDependencies,
): Promise<{ image: GeneratedImage; qualityWarnings: ImageQualityWarning[] }> {
  let image: GeneratedImage | undefined;
  let qualityWarnings: ImageQualityWarning[] = [];

  for (
    let qualityAttempt = 1;
    qualityAttempt <= QUALITY_RETRY_ATTEMPTS;
    qualityAttempt += 1
  ) {
    const retryRepair =
      qualityAttempt === 1 || qualityWarnings.length === 0
        ? ""
        : `\n\nMANDATORY RETRY REPAIR\nThe previous attempt was rejected by automated production QA. Correct every issue below instead of repeating the same composition:\n${qualityWarnings.map((warning) => `- ${warning.message}`).join("\n")}\nReturn a newly rendered image that satisfies the original specification and these corrections exactly.`;
    image = await dependencies.imageProvider.generate({
      prompt: `${input.prompt}${retryRepair}`,
      background: input.outputBackground,
    });
    qualityWarnings =
      (await dependencies.imageQualityGate?.inspect({
        bytes: image.bytes,
        purpose: input.purpose,
        stylePreset: input.stylePreset,
        backgroundContract: input.qualityContract,
      })) ?? [];

    if (input.outputBackground === "transparent") {
      const metadata = await dependencies.imageProcessor.inspect({
        bytes: image.bytes,
      });
      if (!metadata.hasAlpha) {
        qualityWarnings = [
          ...qualityWarnings,
          {
            code: "MISSING_ALPHA_CHANNEL",
            message:
              "The provider painted an opaque canvas. Return a native RGBA PNG whose pixels outside the icon artwork are fully transparent.",
          },
        ];
      }
    }

    if (!qualityWarnings.some(isBlockingWarning))
      return { image, qualityWarnings };

    if (qualityAttempt < QUALITY_RETRY_ATTEMPTS) {
      dependencies.logger.info(
        "Retrying generated image after a blocking quality warning",
        {
          jobId: input.jobId,
          variantId: input.variantId,
          qualityAttempt,
          qualityWarningCodes: qualityWarnings.map((warning) => warning.code),
        },
      );
      continue;
    }
  }

  throw createTerminalQualityError(input.variantId, qualityWarnings);
}
