import { INTERACTION_ASSET_SPEC, SHARED_PRODUCTION_BOUNDARIES } from "../production-boundaries";
import type { CompileIconPromptInput } from "../types";
import { getIconGeometryContract } from "../geometry-contracts";
import { getConfiguredBackgroundQualityContract } from "../background-contracts";

const describeColor = (color: CompileIconPromptInput["color"]) => color.mode === "solid"
  ? `solid ${color.color}`
  : `gradient ${color.colors.join(" to ")} ${color.direction}`;

const describeBackground = (background: CompileIconPromptInput["background"]) => {
  if (!background.enabled) return "transparent canvas with a real alpha channel; no simulated transparency pattern";
  const shape = background.container === "rounded-square"
    ? `rounded-square container${background.cornerRadius === undefined ? "" : ` with a ${background.cornerRadius}% corner radius`}`
    : `${background.container} container`;
  return `${shape} filled with ${describeColor(background.color)}`;
};

export function compileInteractionPrompt(input: CompileIconPromptInput, direction: string) {
  const geometry = getIconGeometryContract(input);
  const configuredBackground = getConfiguredBackgroundQualityContract(
    input.style.preset,
    input.background,
    input.slot,
  );
  const promptBackground =
    input.background.enabled && configuredBackground
      ? {
          ...input.background,
          color:
            configuredBackground.mode === "gradient"
              ? {
                  mode: "gradient" as const,
                  colors: configuredBackground.colors,
                  direction:
                    input.background.color.mode === "gradient"
                      ? input.background.color.direction
                      : ("top-left-to-bottom-right" as const),
                }
              : {
                  mode: "solid" as const,
                  color: configuredBackground.color,
                },
        }
      : input.background;
  const setConsistency = input.iconSetConsistency?.enabled
    ? [
        "ICON SET CONSISTENCY (MANDATORY)",
        input.iconSetConsistency.subjectCount > 1
          ? `This asset belongs to one coordinated set of ${input.iconSetConsistency.subjectCount} icons. Use the same optical scale, visual center, safe margins, detail density, and apparent weight for every subject in this batch.`
          : "Follow the requested absolute icon geometry settings exactly.",
        `FIXED SUBJECT SIZE PARAMETER: the subject optical bounding box must occupy ${input.iconSetConsistency.targetOccupancyPercent}% of the square canvas. Treat this percentage as a fixed generation parameter, not a suggestion. Keep its optical center on the canvas center; do not enlarge simple symbols or shrink complex symbols.`,
        input.style.graphicStructure === "linear"
          ? `FIXED STROKE WIDTH PARAMETER: use one invariant monoline system with apparent stroke width ${input.iconSetConsistency.targetStrokeWidthPercent}% of the canvas. Treat this percentage as a fixed generation parameter, not a suggestion. Use identical rounded caps, identical rounded joins, and consistent internal spacing. Do not mix thin and bold strokes or change icon scale between subjects.`
          : "Use one invariant filled-glyph weight and matching negative-space proportions across the entire batch.",
      ].join("\n")
    : "";
  return [
    "USE CASE\nproduction-ui-icon",
    "TASK\nCreate exactly one original in-app interaction icon.",
    `SUBJECT\nName: ${input.name}\nMeaning: ${input.description}`,
    `VISUAL SYSTEM\nGraphic structure: ${input.style.graphicStructure === "filled" ? "filled solid glyph with clear negative space" : "linear outline glyph with no fill"}.\nSubject color: ${describeColor(input.color)}.\nSubject opacity: ${input.style.subjectOpacityPercent}% (100% means fully opaque artwork; lower values must preserve the requested visual opacity).\nIcon background: ${describeBackground(promptBackground)}.\nUse consistent optical weight, balanced geometry, and crisp edges.`,
    !input.background.enabled && input.style.graphicStructure === "filled"
      ? "TRANSPARENT FILLED GLYPH CONTRACT (MANDATORY)\nRender only the filled glyph as foreground artwork on a genuinely empty alpha canvas. The glyph must not be interpreted as a filled square, tile, badge, card, container, or canvas background. Preserve clear transparent space around its complete silhouette."
      : "",
    `VARIANT\n${direction}`,
    `GEOMETRY INTEGRITY (MANDATORY)\nCategory: ${geometry.category}. ${geometry.prompt} Variant differences may change secondary construction only; they must never damage the canonical semantic skeleton or recognizability.`,
    setConsistency,
    "LEGIBILITY\nUse a clear silhouette, crisp contours, and restrained detail suitable for a production UI icon.",
    `PRODUCTION BOUNDARY\n${INTERACTION_ASSET_SPEC} ${SHARED_PRODUCTION_BOUNDARIES}`,
    "OUTPUT\nReturn one square PNG-ready production asset. A requested transparent background must contain a real alpha channel.",
  ].join("\n\n");
}
