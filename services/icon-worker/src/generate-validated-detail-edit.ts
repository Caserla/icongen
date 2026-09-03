import type {
  GeneratedImage,
  ImageQualityWarning,
  ProcessGenerationJobDependencies,
} from "@icongen/backend-core";
import type { CreateGenerationJobInput, IconStyle } from "@icongen/shared";
import { createDetailEditRequest } from "./detail-edit-request";

const MAX_ATTEMPTS = 3;
const BLOCKING_CODES = new Set([
  "FAKE_TRANSPARENCY_CHECKERBOARD",
  "MISSING_ALPHA_CHANNEL",
  "OPAQUE_TRANSPARENT_CANVAS_EDGE",
  "EDIT_NO_VISIBLE_CHANGE",
  "APP_ICON_DARK_OUTER_CORNERS",
  "SOURCE_NOT_SQUARE",
]);

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
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const correction = attempt === 1
      ? ""
      : lastWarnings.some((warning) => warning.code === "EDIT_NO_VISIBLE_CHANGE")
        ? `\n\nVISIBLE EDIT CORRECTION — RETRY ${attempt}\nThe previous output remained visually indistinguishable from the source. Apply the requested change clearly and observably to the named element while preserving every unspecified element. Do not return the source unchanged and do not limit the edit to antialiasing, compression, edge cleanup, or imperceptible pixel shifts. Diagnostics: ${lastWarnings.map((warning) => warning.message).join(" ")}`
        : `\n\nTRANSPARENCY CORRECTION — RETRY ${attempt}\nThe previous result failed the transparent-edge contract: ${lastWarnings.map((warning) => warning.message).join(" ")} Re-edit from the supplied source. Outside the subject use only one edge-connected pure #00FF00 working region. All four corners must be #00FF00. Do not render black, white, gray, checkerboard, halo, shadow, glow or any opaque presentation canvas.`;
    let image = await dependencies.imageProvider.generate(
      createDetailEditRequest({
        compiledPrompt: input.compiledPrompt,
        instruction: `${input.instruction}${correction}`,
        outputBackground: input.outputBackground,
        sourceBytes: input.sourceBytes,
      }),
    );
    if (input.outputBackground === "transparent") {
      if (dependencies.imageProcessor.normalizeTransparentBackground) {
        image = await dependencies.imageProcessor.normalizeTransparentBackground({
          bytes: image.bytes,
          chromaColor: { red: 0, green: 255, blue: 0 },
          tolerance: 72,
        });
      } else if (dependencies.imageProcessor.removeChromaBackground) {
        image = await dependencies.imageProcessor.removeChromaBackground({
          bytes: image.bytes,
          color: { red: 0, green: 255, blue: 0 },
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
