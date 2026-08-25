import { INTERACTION_ASSET_SPEC, SHARED_PRODUCTION_BOUNDARIES } from "../production-boundaries";
import type { CompileIconPromptInput } from "../types";

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
  return [
    "USE CASE\nproduction-ui-icon",
    "TASK\nCreate exactly one original in-app interaction icon.",
    `SUBJECT\nName: ${input.name}\nMeaning: ${input.description}`,
    `VISUAL SYSTEM\nGraphic structure: ${input.style.graphicStructure === "filled" ? "filled solid glyph with clear negative space" : "linear outline glyph with no fill"}.\nSubject color: ${describeColor(input.color)}.\nIcon background: ${describeBackground(input.background)}.\nUse consistent optical weight, balanced geometry, and crisp edges.`,
    `VARIANT\n${direction}`,
    `SIZE AND LEGIBILITY\nReference sizes: ${input.sizes.join(", ")}px. Smallest target: ${Math.min(...input.sizes)}px. Simplify details for the smallest target.`,
    `PRODUCTION BOUNDARY\n${INTERACTION_ASSET_SPEC} ${SHARED_PRODUCTION_BOUNDARIES}`,
    "OUTPUT\nReturn one square PNG-ready production asset. A requested transparent background must contain a real alpha channel.",
  ].join("\n\n");
}
