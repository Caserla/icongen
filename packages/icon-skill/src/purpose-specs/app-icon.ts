import { APP_ICON_CANVAS_SPEC, SHARED_PRODUCTION_BOUNDARIES } from "../production-boundaries";
import { getBackgroundQualityContract } from "../background-contracts";
import { getAppIconStyleSpec } from "../style-specs/app-icon-styles";
import { getApprovedStyleReference } from "../style-specs/approved-style-references";
import type { CompileIconPromptInput } from "../types";
import { appIconRequestsNoBackground, compileProductionAppIconPrompt } from "./production-app-icon-template";

export function compileAppIconPrompt(input: CompileIconPromptInput, direction: string, fallbackStyle: string) {
  const styleSpec = getAppIconStyleSpec(input.style.preset, fallbackStyle);
  const approvedReference = getApprovedStyleReference(input.style.preset);
  const noBackground = appIconRequestsNoBackground(input);
  const qualityContract = getBackgroundQualityContract(input.style.preset, input.slot);
  const backgroundContract = qualityContract?.mode === "gradient"
    ? `Use a smooth linear gradient from ${qualityContract.colors[0]} to ${qualityContract.colors[1]} across the whole square canvas. The gradient is continuous and even from edge to edge, with no isolated fog bank, smoke, cloudy patch, spotlight, vignette, texture, or secondary panel. Neon glow belongs only to the subject's luminous paths and may not alter the outer background field.`
    : `Use exactly one uniform matte solid background color ${qualityContract?.color ?? "from the approved palette"}. Every background pixel not covered by the subject keeps the same RGB value. Material lighting, ambient occlusion, contact shadow, color bounce, texture, and tonal modeling apply only to the subject and never to the background. The background has no gradient, fog, wash, glow patch, vignette, noise, brush texture, independent circle, or secondary color panel.`;
  return compileProductionAppIconPrompt(input, direction, {
    approvedReferenceProfile: approvedReference?.visualSignature ?? `Approved reference signature: ${fallbackStyle}.`,
    styleFingerprint: styleSpec,
    composition: "Use one dominant, memorable silhouette centered in the square canvas. Keep all essential features inside a balanced safe area, avoid accidental cropping, and reserve enough negative space for immediate recognition at launcher size.",
    colorAndMaterial: `${noBackground ? "Do not add a background color because the user explicitly opted out of a background." : backgroundContract} Apply only the palette, material, lighting, and depth behavior defined by the selected style fingerprint. Do not introduce visual effects belonging to another preset.`,
    edgeAndSmallSizeQuality: "Use clean continuous contours, controlled detail, and crisp antialiased boundaries. The subject and its defining semantic features must remain recognizable at 48 px without stray fragments, muddy edges, or decorative noise.",
    productionBoundary: `${APP_ICON_CANVAS_SPEC} ${SHARED_PRODUCTION_BOUNDARIES}`,
    backgroundContract,
  });
}
