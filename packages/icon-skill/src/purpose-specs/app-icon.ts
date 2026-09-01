import {
  APP_ICON_CANVAS_SPEC,
  SHARED_PRODUCTION_BOUNDARIES,
} from "../production-boundaries";
import { getConfiguredBackgroundQualityContract } from "../background-contracts";
import { getApprovedStyleReference } from "../style-specs/approved-style-references";
import { getAppIconStyleProtocol } from "../style-specs/app-icon-style-protocols";
import { inferIconCategory, normalizeSubjectDescription } from "../subject-normalizer";
import type { CompileIconPromptInput } from "../types";
import {
  appIconRequestsNoBackground,
  compileProductionAppIconPrompt,
} from "./production-app-icon-template";
import { getIconGeometryContract } from "../geometry-contracts";

function functionalRendering(name: string) {
  if (/返回|后退|关闭|取消|更多|菜单|添加|新增|back|close|dismiss|more|menu|add/i.test(name))
    return "Use a lightweight solid construction whose limbs keep a medium-light and optically balanced visual weight.";
  if (/筛选|过滤|排序|filter|sort/i.test(name))
    return "Use a restrained mixed construction containing only semantically necessary solid and medium-light rounded linear parts.";
  return "Use a rounded outline construction with continuous, even, medium-light strokes and round terminals.";
}

export function compileAppIconPrompt(
  input: CompileIconPromptInput,
  direction: string,
) {
  const protocol = getAppIconStyleProtocol(input.style.preset);
  const approvedReference = getApprovedStyleReference(input.style.preset);
  const category = inferIconCategory(input.name, input.description);
  const normalizedDescription = normalizeSubjectDescription(
    input.name,
    input.description,
    category,
  );
  const normalizedInput = { ...input, description: normalizedDescription };
  const noBackground = appIconRequestsNoBackground(input);
  const qualityContract = getConfiguredBackgroundQualityContract(
    input.style.preset,
    input.background,
    input.slot,
  );
  const automaticColorRule =
    input.background.enabled && input.background.autoColor
      ? "These background colors were selected automatically from the approved palette for this style and subject. "
      : "";
  const backgroundContract =
    qualityContract?.mode === "gradient"
      ? `${automaticColorRule}Use a smooth ${input.background.enabled && input.background.color.mode === "gradient" ? input.background.color.direction : "top-left-to-bottom-right"} gradient from ${qualityContract.colors[0]} to ${qualityContract.colors[1]} across the whole square canvas. The gradient is continuous and even from edge to edge, with no isolated fog bank, smoke, cloudy patch, spotlight, vignette, texture, or secondary panel. Neon glow belongs only to the subject's luminous paths and may not alter the outer background field.`
      : `${automaticColorRule}Use exactly one uniform matte solid background color ${qualityContract?.color ?? "from the approved palette"}. Every background pixel not covered by the subject keeps the same RGB value. Material lighting, ambient occlusion, contact shadow, color bounce, texture, and tonal modeling apply only to the subject and never to the background. The background has no gradient, fog, wash, glow patch, vignette, noise, brush texture, independent circle, or secondary color panel.`;
  const categoryLanguage =
    category === "functional" ? protocol.functional : protocol.illustrative;
  const functionalRule =
    category === "functional"
      ? `${functionalRendering(input.name)} Use only one or two uniform solid colors and do not add decorative expressions, stars, stickers, badges, or unrelated ornaments.`
      : "Use at most one semantically necessary supporting symbol and no secondary subject.";
  const setConsistency = input.iconSetConsistency?.enabled
    ? `This asset belongs to one coordinated set of ${input.iconSetConsistency.subjectCount} icons. Every subject in the batch must share the same optical scale, visual center, safe margins, silhouette density, and detail density. Fit the dominant subject to an optical bounding box occupying approximately ${input.iconSetConsistency.targetOccupancyPercent}% of the square canvas. Do not enlarge simple subjects or shrink complex subjects.`
    : "";
  const geometry = getIconGeometryContract(input);

  return compileProductionAppIconPrompt(normalizedInput, direction, {
    approvedReferenceProfile:
      approvedReference?.visualSignature ??
      `Approved reference signature for ${input.style.preset}.`,
    styleFingerprint: [
      `Icon category: ${category}.`,
      categoryLanguage,
      `Color system: ${protocol.palette}.`,
      protocol.depth,
      functionalRule,
      protocol.forbidden,
    ].join(" "),
    composition: `${setConsistency} Geometry integrity category: ${geometry.category}. ${geometry.prompt} ${
      category === "functional"
        ? "Use one familiar, direct symbol centered in the square canvas. Keep open negative space, optically balance the symbol, and preserve immediate recognition at launcher and UI-entry sizes."
        : "Use one dominant, memorable silhouette centered in the square canvas. Keep all defining features inside a balanced safe area, avoid accidental cropping, and reserve enough negative space for immediate recognition at launcher size."
    }`,
    colorAndMaterial: `${noBackground ? "Do not add a background color because the user explicitly opted out of a background." : backgroundContract} Apply only the palette, material, lighting, and depth behavior defined by this style protocol. Never introduce effects belonging to another preset.`,
    edgeAndSmallSizeQuality:
      `Use one clean closed outer silhouette, controlled detail, crisp color boundaries, and natural antialiasing. Do not create breaks, burrs, muddy edges, stray fragments, or isolated decorative marks. ${protocol.smallSize}`,
    productionBoundary: `${APP_ICON_CANVAS_SPEC} ${SHARED_PRODUCTION_BOUNDARIES}`,
    backgroundContract,
  });
}
