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

export function appIconRequestsNoBackground(input: CompileIconPromptInput) {
  return !input.background.enabled;
}

export function compileProductionAppIconPrompt(
  input: CompileIconPromptInput,
  direction: string,
  template: ProductionAppIconTemplate,
) {
  const noBackground = appIconRequestsNoBackground(input);
  if (noBackground) {
    const description = input.description.trim();
    const subject = description.startsWith(input.name.trim())
      ? description
      : `${input.name}\n${description}`;
    // Foreground illustrations use the subject's camera and placement. The
    // launcher directions otherwise force a frontal, centered square layout.
    const foregroundDirections = [
      "Use the most direct, recognizable interpretation of the requested subject, camera, and composition.",
      "Explore a different arrangement of secondary details while preserving the requested camera, composition, and complete structural surfaces.",
      "Simplify secondary details while preserving the requested camera, composition, and complete structural surfaces.",
    ];
    return [
      "TASK\nCreate exactly one complete isolated icon subject. Generate only the requested object and its essential parts; no background, surrounding scene, ground plane, or presentation surface.",
      `SUBJECT\n${subject}`,
      `STYLE\n${template.styleFingerprint}`,
      `COMPOSITION\n${template.composition}`,
      `MATERIAL AND EDGES\n${template.colorAndMaterial} ${template.edgeAndSmallSizeQuality}`,
      `VARIANT DIRECTION\n${foregroundDirections[input.slot - 1]}`,
      `SUBJECT INTEGRITY\n${template.productionBoundary}`,
    ].join("\n\n");
  }
  const deliveryShape = input.background.enabled
    ? input.background.container === "circle"
      ? "Do not draw the circle into the image; the delivery pipeline applies a centered circular alpha mask after generation."
      : input.background.container === "square"
        ? "Keep the full square canvas; the delivery pipeline does not round or mask its corners."
        : `Do not draw rounded corners into the image; the delivery pipeline applies an approximately ${input.background.cornerRadius ?? 22}% rounded-square alpha mask after generation.`
    : "";
  const backgroundRule = `The user did not opt out of a background. The only visible content is the complete icon subject and one intentional full-bleed background. ${template.backgroundContract ?? "Use one intentional style-appropriate background treatment with strong subject contrast."} The background fills the entire square master canvas edge to edge with no visible outer margin, exposed canvas, inset panel, pale band, white band, or perimeter gap. ${deliveryShape} Its outer edge remains one uninterrupted boundary made only from the background's own treatment, with no secondary outline, rim, stroke, keyline, frame, exterior ring, or contrasting border.`;
  const fileOutput = `Delivery format: directly return the full-bleed square RGBA PNG master. ${deliveryShape}`;
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
