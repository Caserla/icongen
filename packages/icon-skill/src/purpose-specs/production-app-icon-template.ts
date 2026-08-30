import type { CompileIconPromptInput } from "../types";

export type ProductionAppIconTemplate = {
  approvedReferenceProfile: string;
  styleFingerprint: string;
  composition: string;
  colorAndMaterial: string;
  edgeAndSmallSizeQuality: string;
  productionBoundary: string;
  backgroundContract?: string;
};

const NO_BACKGROUND_PATTERN = /(?:不需要|不要|去掉|移除|无|透明)(?:任何)?背景|背景(?:不需要|不要|透明)|no\s+background|without\s+(?:a\s+)?background|transparent\s+background/i;

export function appIconRequestsNoBackground(input: CompileIconPromptInput) {
  return NO_BACKGROUND_PATTERN.test(`${input.name}\n${input.description}`);
}

export function compileProductionAppIconPrompt(
  input: CompileIconPromptInput,
  direction: string,
  template: ProductionAppIconTemplate,
) {
  const noBackground = appIconRequestsNoBackground(input);
  const backgroundRule = noBackground
    ? "The user explicitly requested no background. The only visible content is the complete icon subject and at most one semantically necessary supporting symbol, centered with a balanced 9%–14% empty safety margin."
    : `The user did not opt out of a background. The only visible content is the complete icon subject and one intentional full-bleed background. ${template.backgroundContract ?? "Use one intentional style-appropriate background treatment with strong subject contrast."} The background fills the entire square master canvas edge to edge with no visible outer margin, exposed canvas, inset panel, pale band, white band, or perimeter gap. Do not draw rounded corners into the image: the delivery pipeline applies the shared approximately 22% rounded-square alpha mask after generation. Its outer edge remains one uninterrupted boundary made only from the background's own treatment, with no secondary outline, rim, stroke, keyline, frame, exterior ring, or contrasting border.`;
  const fileOutput = noBackground
    ? "Delivery format: directly return a native RGBA PNG icon file with a transparent background."
    : "Delivery format: directly return the full-bleed square RGBA PNG master; the delivery pipeline applies the rounded alpha corners after generation.";
  return [
    "USE CASE\nproduction-app-icon",
    "TASK\nCreate exactly one original, production-ready app icon asset for a home screen, launcher, and app store. Do not create a preview board, mockup, icon set, grid, or contact sheet.",
    `SUBJECT\nApp concept: ${input.name}\nMeaning and required visual semantics: ${input.description}`,
    `APPROVED STYLE REFERENCE PROFILE\n${template.approvedReferenceProfile}`,
    `STYLE FINGERPRINT\n${template.styleFingerprint}`,
    `BACKGROUND RULE\n${backgroundRule}`,
    `COMPOSITION AND SAFE AREA\n${template.composition}`,
    `COLOR, MATERIAL, AND DEPTH\n${template.colorAndMaterial}`,
    `VARIANT DIRECTION\n${direction}`,
    `EDGE AND SMALL-SIZE QUALITY\n${template.edgeAndSmallSizeQuality}`,
    `PRODUCTION BOUNDARY\n${template.productionBoundary}`,
    `FILE OUTPUT\n${fileOutput}`,
  ].join("\n\n");
}
