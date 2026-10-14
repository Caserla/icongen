import { z } from "zod";

const roleSchema = z.enum(["primary", "primaryShade", "secondary", "tertiary", "neutral"]);
const pathSchema = z.object({
  tag: z.literal("path"),
  d: z.string().min(1).max(4000).refine(value => !/[<>]/.test(value), "Invalid path data"),
  fillRule: z.enum(["nonzero", "evenodd"]).optional(),
});
const circleSchema = z.object({ tag: z.literal("circle"), cx: z.number(), cy: z.number(), r: z.number().positive() });
const ellipseSchema = z.object({ tag: z.literal("ellipse"), cx: z.number(), cy: z.number(), rx: z.number().positive(), ry: z.number().positive() });
const shapeSchema = z.discriminatedUnion("tag", [pathSchema, circleSchema, ellipseSchema]);
export const illustrativeDesignPlanSchema = z.object({
  chosenObject: z.string().min(1).max(120),
  silhouette: z.string().min(1).max(240),
  diagnosticFeatures: z.array(z.string().min(1).max(160)).min(1).max(12),
  assemblyRelations: z.array(z.string().min(1).max(180)).max(12),
});
const documentSchema = z.object({
  designPlan: illustrativeDesignPlanSchema,
  parts: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/).max(60),
    meaning: z.string().min(1).max(160),
    role: roleSchema.optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    shapes: z.array(shapeSchema).min(1).max(8),
  })).min(1).max(8),
});

export const ILLUSTRATIVE_DESIGN_PLAN_PROMPT = `
Plan one flat illustrative icon without changing the user's subject. Return JSON:
{"chosenObject":"faithful object or conventional symbol","silhouette":"viewpoint, proportions, contour rhythm and distinction from closest look-alike","diagnosticFeatures":["actual identity-bearing features"],"assemblyRelations":["actual connection, occlusion, alignment or gap; empty if not applicable"]}
Allocate body, opening and real attachment space before details. No fixed feature count; never invent a secondary housing, tube, inset, side plane or miniature scene. Preserve semantic counts. A simple symbol may remain simple. Choose familiar subject-specific proportions, not a generic shell; genuinely box-shaped objects can remain box-shaped. Describe concrete decisions, not quality slogans.
`;

export const ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT = `
ILLUSTRATIVE STRUCTURED OUTPUT CONTRACT
Return only JSON: {"designPlan":{"chosenObject":"approved object","silhouette":"approved silhouette","diagnosticFeatures":["approved real features"],"assemblyRelations":["approved relations"]},"parts":[{"id":"stable-semantic-part-id","meaning":"real component","color":"#RRGGBB","shapes":[{"tag":"path","d":"...","fillRule":"nonzero|evenodd"}]}]}
Copy the approved plan and implement its actual features. Use native path/circle/ellipse geometry within a 24-unit canvas. No SVG strings, strokes, gradients, opacity, transforms, CSS or backgrounds. Use correct compound paths for transparent holes, never white covering shapes.
Build familiar proportions, deliberate contour rhythm, attachment dimensions and roots, occlusion order and clear openings before detail. Stable part IDs refer to real components; repeated instances get separate IDs. Circular parts may be circles. Do not invent shoulders or mechanisms just to avoid primitives.
Create compact flat illustrative geometry with a clear main silhouette and meaningful internal relationships. Part count follows the subject, not a five-feature, three-color or attachment quota. Keep one visual center without universal body/attachment area percentages. Remove redundant lines and decoration, not essential parts.
Color boundaries follow real surfaces and materials. Use explicit hex paints under the supplied runtime policy; no fixed color-slot list or copying reference-sheet paints. Paired parts and shared materials remain coherent. Preserve the selected illustrative treatment without unrequested faces or accessories. Express genuine depth by structural overlap only where useful, never arbitrary slices, detached duplicates or invented planes.
`;

export function parseIllustrativeDesignPlan(value: unknown) {
  return illustrativeDesignPlanSchema.parse(value);
}

function parseJson(raw: string) {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return documentSchema.parse(JSON.parse(text));
}

function number(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) > 1000) throw new Error("Invalid illustrative coordinate");
  return Number(value.toFixed(3)).toString();
}

export function renderIllustrativeStructuredSvg(raw: string, _colors?: unknown) {
  const document = parseJson(raw);
  const ids = new Set<string>();
  const content = document.parts.map(part => {
    if (ids.has(part.id)) throw new Error("Duplicate illustrative part id");
    ids.add(part.id);
    const fill = part.color.toUpperCase();
    const shapes = part.shapes.map(shape => {
      if (shape.tag === "path") return `<path d="${shape.d}" fill="${fill}"${shape.fillRule ? ` fill-rule="${shape.fillRule}"` : ""}/>`;
      if (shape.tag === "circle") return `<circle cx="${number(shape.cx)}" cy="${number(shape.cy)}" r="${number(shape.r)}" fill="${fill}"/>`;
      if (shape.tag === "ellipse") return `<ellipse cx="${number(shape.cx)}" cy="${number(shape.cy)}" rx="${number(shape.rx)}" ry="${number(shape.ry)}" fill="${fill}"/>`;
      throw new Error("Unsupported illustrative shape");
    }).join("");
    return `<g id="${part.id}" data-meaning="${part.meaning.replace(/[&<>"']/g, "")}">${shapes}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${content}</svg>`;
}
