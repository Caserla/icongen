import { z } from "zod";

export const svgDesignPlanSchema = z.object({
  preservedIntent: z.string().trim().min(1).max(600),
  representation: z.string().trim().min(1).max(400),
  recognitionTest: z.string().trim().min(1).max(400),
  gridPlan: z.string().trim().min(1).max(400),
  lineSystem: z.string().trim().min(1).max(400),
  cornerSystem: z.string().trim().min(1).max(400),
  complexityBudget: z.string().trim().min(1).max(500),
  referenceProfile: z.object({
    opticalWeight: z.string().trim().min(1).max(300),
    capJoinLanguage: z.string().trim().min(1).max(300),
    cornerLanguage: z.string().trim().min(1).max(300),
    spacingRhythm: z.string().trim().min(1).max(300),
    detailDensity: z.string().trim().min(1).max(300),
    silhouetteTreatment: z.string().trim().min(1).max(300),
    colorTreatment: z.string().trim().min(1).max(300),
  }),
  mainContour: z.string().trim().min(1).max(600),
  identityParts: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  connections: z.array(z.string().trim().min(1).max(240)).max(8),
  alignment: z.string().trim().min(1).max(500),
  contourQuality: z.string().trim().min(1).max(500),
  strokePolicy: z.string().trim().min(1).max(300),
  styleApplication: z.string().trim().min(1).max(500),
  forbidden: z.array(z.string().trim().min(1).max(160)).min(1).max(12),
});

export type SvgDesignPlan = z.infer<typeof svgDesignPlanSchema>;

export const SVG_DESIGN_PLAN_PROMPT = `Create a pre-generation geometry plan for one App/SaaS interaction icon. Return only JSON matching:
{"preservedIntent":string,"representation":string,"recognitionTest":string,"gridPlan":string,"lineSystem":string,"cornerSystem":string,"complexityBudget":string,"referenceProfile":{"opticalWeight":string,"capJoinLanguage":string,"cornerLanguage":string,"spacingRhythm":string,"detailDensity":string,"silhouetteTreatment":string,"colorTreatment":string},"mainContour":string,"identityParts":string[],"connections":string[],"alignment":string,"contourQuality":string,"strokePolicy":string,"styleApplication":string,"forbidden":string[]}.
This stage happens before any SVG path is drawn. Preserve the supplied user intent exactly. Do not add, optimize, reinterpret or replace the requested subject, action, state, count or relationship.
Choose the simplest conventional UI pictogram that communicates the exact intent at 24px. For an activity, feature or abstract concept, prefer one canonical tool, object or compact symbol over a character, scene or literal narrative. Do not turn a feature icon into a mascot or illustration. representation must name this one pictogram and reject plausible but more complex alternatives.
recognitionTest states what the icon must remain recognizable as when viewed as a flat one-color silhouette at 24px. If it needs color, texture, many internal pieces or a caption to become understandable, replace the representation before returning the plan.
Plan this as a production UI icon, not freely drawn vector art. gridPlan defines a 24-unit grid, approximately 2-unit safe margins, the optical center, dominant width/height and the small set of shared alignment coordinates. lineSystem defines exactly one optical stroke width, cap and join for every visible line when the selected style uses strokes; fill-led styles instead define one consistent structural thickness for openings and narrow parts. cornerSystem defines a small reusable family of corner radii and tangent transitions; no arbitrary radius changes or lumpy freehand curves. complexityBudget permits one dominant contour and at most two or three groups of identity details, with clear gaps at target size; remove nonessential detail instead of shrinking, crossing or stacking it.
When a reference board is attached, referenceProfile is mandatory visual evidence extracted from that board—not a generic description of the style name. Describe the repeated, observable treatment shared by the board icons for opticalWeight, capJoinLanguage, cornerLanguage, spacingRhythm, detailDensity, silhouetteTreatment and colorTreatment. Use concise operational language that another model can execute. Do not describe or copy the board's subjects. lineSystem, cornerSystem, complexityBudget, strokePolicy and styleApplication must agree with referenceProfile. When no board is attached, derive the same fields from the supplied style contract.
Define one visually unified construction. mainContour describes one dominant enclosing silhouette, not a pile of separate closed shapes. identityParts lists only structures required for first-glance recognition. connections states which parts fuse into the dominant contour, which are internal cutouts, and which are genuinely detached by convention. A single physical subject may not be assembled from overlapping complete shapes, floating patches, stacked stickers, or an assortment of rectangles and rounded rectangles. Rectangles are allowed only when the requested real object has an inherently rectangular structural part; they must share the planned axis, proportions and physical junctions and may never be used as generic building blocks to approximate an organic subject. At an occlusion, rear geometry stops at the boundary instead of continuing underneath as a complete object. alignment defines the axis, baseline, spacing and proportional order. contourQuality prevents wobble, malformed bulges, accidental flat spots, jagged fragments, arbitrary rotations and unexplained asymmetry. strokePolicy must use one consistent visible stroke thickness whenever the selected substyle uses strokes; fill-only styles must not gain miscellaneous outlines. styleApplication applies only the supplied selected substyle contract and must not borrow treatment from another style. forbidden lists concrete subject-specific failure modes, including likely pasted-on parts, collisions, ambiguous blobs and rectangle stacking.
Path count is not a quality target. Do not remove identity-bearing structure merely to reduce paths, and do not add decorative geometry to appear detailed.`;

export function parseSvgDesignPlan(value: unknown) {
  return svgDesignPlanSchema.parse(value);
}
