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
  diagnosticFeatures: z.array(z.string().min(1).max(160)).length(5),
  assemblyRelations: z.array(z.string().min(1).max(180)).min(4).max(6),
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
Plan the concrete anatomy for one Illustrative Multicolor App/SaaS icon before any SVG path is drawn. Preserve the user's meaning exactly. Return only JSON:
{"chosenObject":"one concrete recognizable object or one physically connected equipment assembly","silhouette":"specific outer contour, viewpoint and proportions","diagnosticFeatures":["dominant outer body","internal inset or opening","real thickness or side surface","secondary functional body or mechanism","connected external functional attachment"],"assemblyRelations":["4 to 6 precise containment, attachment, symmetry, spacing or occlusion relationships"]}

Do not choose the simplest possible pictogram. Choose the clearest structurally complete representation that remains legible at 24px. For a broad activity, workflow or domain, select one coherent representative equipment assembly with a dominant object and one or two physically connected functional attachments. Do not use an abstract emblem, generic U-shape, badge, floating semantic symbol or miniature scene.
Do not manufacture complexity by replacing the familiar representative object with an obscure industrial, historical or specialist variant. Keep the most universally recognizable consumer-facing object for the activity, then obtain richness from its real frame, inset surface, lower functional body, connector and attached tube or accessory. The result should read as familiar equipment before it reads as machinery.
Semantic disambiguation example for the general planning policy: an underwater diving or diving-exploration feature uses a familiar face-worn diving mask/goggle assembly as the dominant body, readable paired lenses or face cavity as the inset, a substantial rounded regulator or breathing housing centered across the lower edge, and one continuous hose routed from that housing toward the side. The nose bridge or nose pocket remains subordinate and occupies no more than about 15% of the main mask; it never becomes a large central blob. The regulator is a coherent circular or softly rounded mechanism, not a vertical rectangle, and carries roughly 18–25% of visual mass. Its hose leaves the right side with nearly constant width and one smooth continuous bend—no sharp elbow, sudden swelling or segmented decoration. It is not represented by an industrial helmet, oxygen tank, single-lens teardrop, snorkel-only accessory or abstract water symbol. Apply the same principle—not these literal objects—to other broad activities: choose the most familiar equipment assembly and preserve its defining working mechanism.
Name visible physical structures, not style adjectives. The silhouette must state the governing axis, dominant width/height and characteristic contour. diagnosticFeatures must contain exactly five complementary structural roles: dominant outer body, internal inset/opening, real thickness/side surface, a secondary functional body or mechanism, and a connected external functional attachment. A passive strap, buckle, border, seam, decorative cap or repeated copy of the main part cannot satisfy either functional role. For wearable or activity equipment, prefer a working valve, controller, filter, mouthpiece, housing or comparable mechanism plus its genuinely connected tube, cable, handle or tool. Do not satisfy two roles with renamed copies of the same simple part. assemblyRelations must state where parts connect, nest, align, mirror, overlap or keep a deliberate gap. Paired manufactured parts must be explicitly symmetric unless the real object is asymmetric.
Reject plans whose identity depends mainly on concentric circles, a generic container silhouette, mirrored pills or repeated rounded blocks. Prefer the view and equipment choice with the most characteristic non-circular contour, functional junctions and readable part-to-part topology. Every attachment must name its real mounting root or receiving connector; a tube or cable must form one continuous route from that connector rather than begin as a detached decorative curve.
Define visual hierarchy numerically: the dominant body should carry roughly 60–70% of the visual mass, the secondary functional body or mechanism roughly 18–25%, and the external connector or tube remain subordinate. When physically plausible, attach the secondary functional body at the lower center or lower edge of the dominant body so the assembly keeps one visual center; route its tube or cable outward from that mechanism. Do not enlarge a tube, strap or side accessory until it dominates the main body.
`;

export function parseIllustrativeDesignPlan(value: unknown) {
  return illustrativeDesignPlanSchema.parse(value);
}

export const ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT = `
ILLUSTRATIVE STRUCTURED OUTPUT CONTRACT.
Return only one JSON object, never SVG or Markdown:
{"designPlan":{"chosenObject":"one concrete representative object or connected equipment assembly","silhouette":"recognizable outer contour and proportions","diagnosticFeatures":["exactly five complementary visible structural roles from the approved plan"],"assemblyRelations":["at least four explicit physical connections, nesting, symmetry or spacing relationships"]},"parts":[{"id":"semantic-part-id","meaning":"real structural part","color":"#RRGGBB","shapes":[{"tag":"path","d":"...","fillRule":"nonzero|evenodd"}]}]}

You design each part’s explicit six-digit hex color. The server preserves your chosen paints; there is no fixed color-slot palette. In smart mode project colors are optional harmony references, not an allowed-color list. Prioritize recognizable subject/material colors and the selected style, then coordinate temperature, saturation and contrast with the project where appropriate. New hues are allowed. Never recolor a diagnostic natural surface merely to fit a project slot. Do not copy reference-sheet object colors onto unrelated subjects. Never output a stroke, gradient, opacity, transform, style, SVG element or background.
Use viewBox coordinates 0..24 and keep every shape safely inside the canvas. Build one compact flat illustration with the authoritative preview's broad custom silhouette, plump rounded contour rhythm, friendly proportions, restrained internal detail and small but clear structural overlaps. Do not copy the preview subject. This is the Illustrative Multicolor style, not a minimal duotone glyph: use 5–8 meaningful structural parts and make at least 3 paint roles visibly contribute to the finished object.
First construct a structurally complete master object, then simplify it for 24px. Do not start from the fewest geometric blocks. Preserve the subject's characteristic outer body, inner surface or opening, thickness or side plane, attachment points and one diagnostic functional component whenever those structures exist. Complexity is welcome when every part explains real form or function; simplicity is not a goal by itself.
When the requested subject is a broad activity, workflow or domain rather than one named object, choose one coherent representative equipment assembly with a clear main object and one or two physically connected functional attachments. Do not collapse the activity into the easiest isolated object, an abstract emblem or a floating status symbol. The assembly must still read as one icon with one visual center, not as a miniature scene.
Do not switch to a niche industrial or historical variant merely because it offers more parts. Preserve the broadly recognized everyday representative object and build complexity from its authentic frame, inset, lower body, connector and attached functional component.
Complete designPlan before writing any path data. Every diagnosticFeatures entry must appear in the final parts, and every assemblyRelations entry must be visible in the geometry through attachment, nesting, alignment, symmetry or deliberate spacing. Do not list a feature merely in text and then omit it from the SVG structure.
Design the subject as an illustrated object, not as a generic UI glyph assembled from a U-shape, bars, pills or rounded boxes. The primary silhouette must be a subject-specific path with deliberate widening, taper, shoulder, opening and curve transitions. Circles and ellipses are allowed only for real circular parts. Do not use a rectangle primitive; if the real object has a box-like part, design its contour as a path with subject-specific proportion and corner rhythm.
Do not construct identity from a large circle plus smaller concentric circles. Even when the real object includes circular parts, its outer silhouette must retain characteristic shoulders, lower transitions, mounting points or connected equipment. Small functional attachments may not be rendered as isolated beans, pills or capsules: show their mounting bracket, connector or receiving boundary. Tubes and cables require one continuous visible route with a believable root and terminal; never leave a detached curved fragment.
Render a secondary functional mechanism as one coherent housing with its real inset or face, not as a circular badge pasted onto a generic rectangle. A tube, hose or cable should use one clean continuous body; do not decorate it with repeated stripes, blocks, ribs or alternating color segments unless those repetitions are essential to the requested object's identity.
Choose a restrained, coherent palette appropriate to the actual object and this illustrative style; do not force a fixed count, slot assignment or area quota. Reuse colors for the same material and mirrored parts. Use darker or lighter related paints for genuine depth, and reserve contrasting accents for meaningful details. Color boundaries must coincide with real components, openings, overlaps or occlusions.
Show restrained illustration depth with an attached same-material side plane or overlap and a readable foreground/background attachment or inset where physically appropriate. Preserve clear breathing gaps between separated parts. Do not use gradients, shadows or outlines. Use evenodd compound paths for true transparent holes, never background-colored shapes.
At 24px the subject must remain instantly recognizable from silhouette and component relationships, while the added surfaces make it feel authored and illustrative. Avoid reducing familiar objects to their most generic archetype. Include up to three diagnostic structural groups, such as outer shell plus inset, paired functional parts, and a real connector or attachment. These may contain multiple coordinated shapes when required, but they must share alignment, symmetry, spacing and a clear visual hierarchy. Keep diagnostic parts integrated into or physically connected to the main object rather than floating nearby.
Keep the dominant body at roughly 60–70% of visual mass. Give the secondary functional housing 18–25% so it remains clearly designed rather than becoming a tiny badge. Tubes, cables, straps and clips are subordinate connectors: they may extend the silhouette but may not become the largest or highest-contrast component. When the real mechanism permits it, connect the secondary housing at the lower center or lower edge of the main body and route the connector outward from it to preserve one coherent visual center.
Never add a floating semantic sticker, playback triangle, search symbol, star, badge or decorative mini-icon unless the user explicitly requested that exact symbol as part of the subject. Do not split a complete surface merely to add color. No decorative slice, offset duplicate, floating patch or generic block collage.
`;

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
