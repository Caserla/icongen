import type {
  GeneratedImage,
  ImageQualityWarning,
  ProcessGenerationJobDependencies,
} from "@icongen/backend-core";
import type { CreateGenerationJobInput, IconStyle } from "@icongen/shared";
import { createDetailEditRequest } from "./detail-edit-request";
import { chromaHex, selectChromaKey } from "./select-chroma-key";

const MAX_ATTEMPTS = 3;
const BLOCKING_CODES = new Set([
  "FAKE_TRANSPARENCY_CHECKERBOARD",
  "MISSING_ALPHA_CHANNEL",
  "OPAQUE_TRANSPARENT_CANVAS_EDGE",
  "EDIT_NO_VISIBLE_CHANGE",
  "APP_ICON_DARK_OUTER_CORNERS",
  "SOURCE_NOT_SQUARE",
]);

export function isNativeTransparencyUnsupported(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /transparent background is not supported|background[^\n]*transparent[^\n]*(unsupported|not supported)/i.test(message);
}

export async function generateValidatedDetailEdit(
  input: {
    editId: string;
    compiledPrompt: string;
    instruction: string;
    outputBackground?: "transparent" | "opaque";
    sourceBytes: Uint8Array;
    purpose: CreateGenerationJobInput["purpose"];
    stylePreset: IconStyle["preset"];
  },
  dependencies: ProcessGenerationJobDependencies,
): Promise<GeneratedImage> {
  let lastWarnings: ImageQualityWarning[] = [];
  const chromaColor = input.outputBackground === "transparent"
    ? await selectChromaKey(input.sourceBytes)
    : undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const transparencyStrategy = attempt === 1 ? "native-alpha" : "chroma-key";
    const correction = attempt === 1
      ? ""
      : lastWarnings.some((warning) => warning.code === "EDIT_NO_VISIBLE_CHANGE")
        ? `\n\nVISIBLE EDIT CORRECTION — RETRY ${attempt}\nThe previous output remained visually indistinguishable from the source. Apply the requested change clearly and observably to the named element while preserving every unspecified element. Do not return the source unchanged and do not limit the edit to antialiasing, compression, edge cleanup, or imperceptible pixel shifts. Diagnostics: ${lastWarnings.map((warning) => warning.message).join(" ")}`
        : `\n\nTRANSPARENCY CORRECTION — RETRY ${attempt}\nThe previous native-alpha result failed the transparent-edge contract: ${lastWarnings.map((warning) => warning.message).join(" ")} Re-edit from the supplied source using one edge-connected pure ${chromaHex(chromaColor!)} working region outside the complete artwork. All four corners must be ${chromaHex(chromaColor!)}. Do not render black, white, gray, checkerboard, halo, shadow, glow or any opaque presentation canvas.`;
    let image: GeneratedImage;
    try {
      image = await dependencies.imageProvider.generate(
        createDetailEditRequest({
          compiledPrompt: input.compiledPrompt,
          instruction: `${input.instruction}${correction}`,
          outputBackground: input.outputBackground,
          transparencyStrategy,
          chromaColor,
          sourceBytes: input.sourceBytes,
        }),
      );
    } catch (error) {
      if (
        attempt === 1 &&
        input.outputBackground === "transparent" &&
        isNativeTransparencyUnsupported(error)
      ) {
        lastWarnings = [{
          code: "MISSING_ALPHA_CHANNEL",
          message: "The provider does not support native transparent image edits; use the chroma-key fallback.",
        }];
        dependencies.logger.info("Falling back from native alpha to chroma-key detail editing", {
          editId: input.editId,
        });
        continue;
      }
      throw error;
    }
    if (input.outputBackground === "transparent" && transparencyStrategy === "chroma-key") {
      if (dependencies.imageProcessor.normalizeTransparentBackground) {
        image = await dependencies.imageProcessor.normalizeTransparentBackground({
          bytes: image.bytes,
          chromaColor: chromaColor!,
          tolerance: 72,
        });
      } else if (dependencies.imageProcessor.removeChromaBackground) {
        image = await dependencies.imageProcessor.removeChromaBackground({
          bytes: image.bytes,
          color: chromaColor!,
          tolerance: 72,
        });
      }
    }
    const metadata = await dependencies.imageProcessor.inspect({ bytes: image.bytes });
    const warnings = (await dependencies.imageQualityGate?.inspect({
      bytes: image.bytes,
      purpose: input.purpose,
      stylePreset: input.stylePreset,
      outputBackground: input.outputBackground,
      editSourceBytes: input.sourceBytes,
    })) ?? [];
    if (
      input.outputBackground === "transparent" &&
      (!metadata.hasAlpha || metadata.hasTransparency === false)
    ) {
      warnings.push({
        code: "MISSING_ALPHA_CHANNEL",
        message: "The adjusted icon does not contain genuinely transparent pixels after chroma conversion.",
      });
    }
    lastWarnings = warnings.filter((warning) => BLOCKING_CODES.has(warning.code));
    if (lastWarnings.length === 0) return image;
    dependencies.logger.info("Retrying detail edit after transparent-edge validation", {
      editId: input.editId,
      attempt,
      warningCodes: lastWarnings.map((warning) => warning.code),
    });
  }
  throw new Error(
    lastWarnings.some((warning) => warning.code === "EDIT_NO_VISIBLE_CHANGE")
      ? `Detail edit produced no visible change after ${MAX_ATTEMPTS} attempts`
      : `Detail edit failed transparent-edge validation after ${MAX_ATTEMPTS} attempts: ${lastWarnings.map((warning) => warning.code).join(", ")}`,
  );
}
