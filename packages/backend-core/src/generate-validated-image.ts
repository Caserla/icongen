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
  referenceImage?: {
    bytes: Uint8Array;
    mimeType: "image/png" | "image/jpeg" | "image/webp";
    filename: string;
  };
  consistencyReferenceBytes?: Uint8Array;
  consistencyContract?: {
    enabled: boolean;
    linear: boolean;
    targetScale: number;
    minScale: number;
    maxScale: number;
    maxAbsoluteCenterOffset: number;
    minLineWeight: number;
    maxLineWeight: number;
    maxScaleDelta: number;
    maxCenterDelta: number;
    maxLineWeightDelta: number;
  };
  geometryContract?: {
    category: string;
    symmetry: "vertical" | "none";
    maxSymmetryError: number;
  };
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
    warning.code === "MISSING_ALPHA_CHANNEL" ||
    warning.code === "REFERENCE_BOARD_REPRODUCTION" ||
    warning.code === "SOURCE_NOT_SQUARE"
  );
}

function createTerminalQualityError(
  variantId: string,
  warnings: ImageQualityWarning[],
) {
  if (
    warnings.some(
      (warning) => warning.code === "REFERENCE_BOARD_REPRODUCTION",
    )
  )
    return new Error(
      `Generated icon ${variantId} reproduced the complete style reference board after ${QUALITY_RETRY_ATTEMPTS} attempts`,
    );
  if (
    warnings.some((warning) => warning.code === "SOURCE_NOT_SQUARE")
  )
    return new Error(
      `Generated icon ${variantId} is not a square production asset after ${QUALITY_RETRY_ATTEMPTS} attempts`,
    );
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
  const consistencyDiagnostics = warnings
    .filter((warning) =>
      warning.code === "SUBJECT_SCALE_INCONSISTENT" ||
      warning.code === "SUBJECT_ALIGNMENT_INCONSISTENT" ||
      warning.code === "LINE_WEIGHT_INCONSISTENT",
    )
    .map((warning) => warning.message)
    .join(" ");
  if (consistencyDiagnostics)
    return new Error(
      `Generated icon ${variantId} does not match the batch icon-set geometry after ${QUALITY_RETRY_ATTEMPTS} attempts. ${consistencyDiagnostics}`,
    );
  const geometryDiagnostics = warnings
    .filter((warning) => warning.code === "GEOMETRY_SYMMETRY_BROKEN")
    .map((warning) => warning.message)
    .join(" ");
  if (geometryDiagnostics)
    return new Error(
      `Generated icon ${variantId} has invalid semantic geometry after ${QUALITY_RETRY_ATTEMPTS} attempts. ${geometryDiagnostics}`,
    );
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
    const previousBlockingCodes = qualityWarnings
      .filter(isBlockingWarning)
      .map((warning) => warning.code);
    const previousDiagnostics = qualityWarnings
      .filter(isBlockingWarning)
      .map((warning) => warning.message)
      .join(" ");
    const retryInstruction =
      previousBlockingCodes.includes("REFERENCE_BOARD_REPRODUCTION") ||
      previousBlockingCodes.includes("SOURCE_NOT_SQUARE")
        ? "\n\nREFERENCE REPRODUCTION CORRECTION\nThe previous result incorrectly preserved the complete reference board or its presentation canvas. Start again from a blank square canvas. Create exactly one independent icon for the requested subject. Match the reference style closely, but do not return, crop, extract, preserve, or reconstruct the reference board, its grid, its multi-icon layout, or its original aspect ratio."
        : previousBlockingCodes.some((code) =>
              code === "SUBJECT_SCALE_INCONSISTENT" ||
              code === "SUBJECT_ALIGNMENT_INCONSISTENT" ||
              code === "LINE_WEIGHT_INCONSISTENT",
            )
          ? `\n\nICON SET CONSISTENCY CORRECTION\nThe previous result did not match the immutable geometry specification of this icon set. Diagnostics: ${previousDiagnostics} Regenerate the requested subject at the stated absolute target size and line weight, centered on the square canvas. For a linear icon, use uniform rounded monoline strokes throughout. Do not copy another subject; reproduce only the shared scale and construction system.`
          : previousBlockingCodes.includes("GEOMETRY_SYMMETRY_BROKEN")
            ? "\n\nGEOMETRY INTEGRITY CORRECTION\nThe previous result distorted the canonical semantic skeleton. Rebuild the requested subject with stable standard geometry, correct topology, smooth closed contours, and the required symmetry. Preserve the expected number and even distribution of points, lobes, or essential parts. Do not skew, stretch, twist, collapse, or use deformation to make this variant different."
          : "";
    image = await dependencies.imageProvider.generate({
      prompt: `${input.prompt}${retryInstruction}`,
      background: input.outputBackground,
      referenceImage: input.referenceImage,
    });
    if (
      input.outputBackground === "transparent" &&
      input.referenceImage &&
      dependencies.imageProcessor.removeChromaBackground
    ) {
      image = await dependencies.imageProcessor.removeChromaBackground({
        bytes: image.bytes,
        color: { red: 0, green: 255, blue: 0 },
        tolerance: 72,
      });
    }
    qualityWarnings =
      (await dependencies.imageQualityGate?.inspect({
        bytes: image.bytes,
        referenceImageBytes: input.referenceImage?.bytes,
        consistencyReferenceBytes: input.consistencyReferenceBytes,
        consistencyContract: input.consistencyContract,
        geometryContract: input.geometryContract,
        purpose: input.purpose,
        stylePreset: input.stylePreset,
        backgroundContract: input.qualityContract,
      })) ?? [];

    if (input.outputBackground === "transparent") {
      const metadata = await dependencies.imageProcessor.inspect({
        bytes: image.bytes,
      });
      if (!metadata.hasAlpha || metadata.hasTransparency === false) {
        qualityWarnings = [
          ...qualityWarnings,
          {
            code: "MISSING_ALPHA_CHANNEL",
            message:
              "The provider painted an opaque canvas. Return a native RGBA PNG with genuinely transparent pixels outside the icon artwork.",
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
