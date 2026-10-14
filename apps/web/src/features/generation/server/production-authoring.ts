import { z } from "zod";
import contracts from "../../../../../../docs/design/svg-style-production-v3.json";
import { FORM_FIRST_CARD, styleAuthoringRules } from "./style-authoring";
import { COORDINATE_SPACE_RULE, OPEN_CUTOUT_RULE, REPEATED_CONSTRUCTION_RULE } from "./svg-geometry-rules";
import { COLLECTION_ART_DIRECTION } from "./collection-art-direction";
import { GEOMETRY_ASSEMBLY_PROMPT, svgGeometryPlanSchema } from "./svg-geometry-plan";
import { isLibraryGenerationStyle } from "../library-generation-styles";
import { librarySixStyleContract } from "./library-six-authoring";

export const AUTHORING_VERSION = contracts.version;
export function productionStyleContract(styleId: string) {
  if (isLibraryGenerationStyle(styleId)) return librarySixStyleContract(styleId);
  const contract = contracts.styles[styleId as keyof typeof contracts.styles];
  if (!contract) throw new Error(`Unknown production style: ${styleId}`);
  return contract;
}

export const GEOMETRY_DESIGN_CARD = `Before SVG, write a compact designCard of concrete decisions, not a reasoning transcript or generic quality claims:
recognition: selected familiar silhouette, viewpoint and indispensable features; name the nearest plausible look-alike and the visible contour difference that prevents that misreading. A part name alone is not a visible feature.
layout: actual 24-unit positions, body width/height, attachment dimensions and governing axes. State which coordinates/radii are shared, mirrored or repeated; do not independently guess paired parts.
openings: the actual position, shape and usable size of each identity-bearing opening; name the surrounding material thickness. If none, say none. Apertures are designed BEFORE the surrounding mass, not leftover pinholes.
connections: which parts join, share an edge, stay separated or are occluded. Rear edges stop at occluders.
stylePlan: how THIS substyle expresses those parts, including tone/gradient/material assignments and target-surface contrast.
opticalPlan: chosen painted span, dominant visual mass, contour transitions and small-size opening priorities.
colorPlan: exact paints assigned to real parts with approximate visual area and the reason for the dominant/supporting relationship. For monochrome, state the one paint; for manual colors honor the supplied exact values.
parts: stable partId and meaning for visible components; reuse these IDs as data-part-id on SVG geometry.
Then draw from those decisions. For repeated rigid geometry, calculate from one center, radius or spacing; for genuinely mirrored halves use identical coordinates under a local reflection transform rather than approximate independent paths. A single circle/rounded rectangle is valid where it actually describes the part. Allow free paths and intentional natural asymmetry. Keep the number of details driven by identity, not quotas.
On a solid object with a structural aperture, plan the aperture as a generous visible shape and balance the surrounding wall. In a pair, identical openings retain their shape and position; expanding a stroke is not permission to redesign anatomy.
Across styles, preserve the subject's inherent aspect ratio, part proportions, centers, attachment directions and aperture shapes. Never stretch, squash, compress, shear, twist, pinch or warp an object merely to occupy more canvas or signal a style. Fit with uniform scale and optical placement. A deliberate isometric camera must project all related parts consistently; pixel construction may rebuild on one grid; freehand character may ease curves without deforming the underlying anatomy.
Output JSON: {"designCard":{"recognition":"...","layout":"...","openings":"...","connections":"...","stylePlan":"...","opticalPlan":"...","colorPlan":"...","parts":[{"partId":"real-part","meaning":"..."}]},"geometry":{"version":"1","paths":[...]},"svg":"<svg ...>...</svg>"}. Follow the executable geometry output contract below for paths and bindings. No markdown. Use explicit paints and SVG-native primitives; no CSS or use/href. JSON metadata is diagnostic, not a visual approval.`;

export function productionAuthoringPrompt(styleId: string, data: unknown, includeInput = true) {
  return `AUTHORING_VERSION: ${AUTHORING_VERSION}\n${contracts.common}\nSELECTED_PRODUCTION_STYLE (${styleId}): ${productionStyleContract(styleId)}\n${FORM_FIRST_CARD}\n${COLLECTION_ART_DIRECTION}\n${styleAuthoringRules(styleId)}\n${REPEATED_CONSTRUCTION_RULE}\n${COORDINATE_SPACE_RULE}\n${OPEN_CUTOUT_RULE}\n${GEOMETRY_DESIGN_CARD}\n${GEOMETRY_ASSEMBLY_PROMPT}${includeInput ? `\nINPUT_JSON: ${JSON.stringify(data)}` : ""}`;
}

const decision = z.string().trim().min(1).max(3200);
const cardSchema = z.object({
  recognition: decision,
  layout: decision,
  openings: decision,
  connections: decision,
  stylePlan: decision,
  opticalPlan: decision.optional(),
  colorPlan: decision.optional(),
  parts: z.array(z.object({ partId: z.string().regex(/^[a-z][a-z0-9-]*$/).max(80), meaning: decision })).min(1).max(60),
});

export function parseProductionOutput(content: string) {
  const raw = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  return { designCard: cardSchema.parse(raw.designCard), svg: z.string().min(1).max(100_000).parse(raw.svg), ...(raw.geometry === undefined ? {} : { geometry: svgGeometryPlanSchema.parse(raw.geometry) }) };
}
