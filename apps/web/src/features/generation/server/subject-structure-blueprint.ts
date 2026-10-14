import { z } from "zod";

const note = z.preprocess(value => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return JSON.stringify(value);
  return value;
}, z.string().trim().min(1).max(1200));
const limited = <T extends z.ZodTypeAny>(item: T, max: number, min = 0) =>
  z.array(item).min(min).max(max);
export const subjectStructureBlueprintSchema = z.object({
  version: z.literal("1"),
  subject: note,
  canonicalSilhouette: note,
  viewpoint: note,
  proportions: note,
  identityFeatures: limited(note, 6, 2),
  partRelationships: limited(note, 8, 1),
  negativeSpaces: limited(note, 6),
  confusionRisks: limited(z.object({ mistakenFor: note, prevention: note }), 5, 1),
  invariantGeometry: limited(note, 10, 2),
  allowedStyleChanges: limited(note, 8, 1),
}).strict();

export type SubjectStructureBlueprint = z.infer<typeof subjectStructureBlueprintSchema>;

export const SUBJECT_BLUEPRINT_PROMPT = `You are the subject-structure director for a production SVG icon system. Create one style-independent canonical blueprint for the requested subject. It will be reused unchanged across many visual styles.
Return JSON only with: version="1", subject, canonicalSilhouette, viewpoint, proportions, identityFeatures, partRelationships, negativeSpaces, confusionRisks[{mistakenFor,prevention}], invariantGeometry, allowedStyleChanges.

Describe visible geometry, not vague adjectives. Specify the familiar silhouette, canonical viewpoint, proportions, SEMANTIC part count, attachment roots, overlaps and identity-bearing negative spaces. Distinguish semantic parts such as body, stem, handle or wheel from repeated surface marks such as stripes, veins, seams or spots. Do not lock a numerical MINIMUM for decorative or repeated surface marks unless that exact count defines the requested subject. At 24px their number must be reduced or simplified until every retained mark has clear ink-to-ink spacing; preserve their direction, rhythm and role instead of crowding the interior. The requirement for recognizability overrides a decorative mark count. Name realistic neighboring objects or symbols it could be mistaken for and the concrete contour difference that prevents each error. invariantGeometry preserves semantic anatomy and connections, not absolute screen coordinates or decorative mark counts. allowedStyleChanges must allow coherent isometric projection and grid reconstruction for pixel styles while preserving anatomy. Do not prescribe literal SVG paths, colors, lighting, decoration or a particular style. A label or color is never evidence of recognizability. Use strings of at most 1200 characters; identityFeatures 2-6, partRelationships 1-8, negativeSpaces 0-6, confusionRisks 1-5, invariantGeometry 2-10, allowedStyleChanges 1-8. Never omit an essential rule to meet these limits; consolidate related rules.`;

export async function createSubjectStructureBlueprint(
  subject: { name: string; description: string },
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
) {
  const base = process.env.IMAGE_PROVIDER_BASE_URL?.replace(/\/$/, "");
  const key = process.env.IMAGE_PROVIDER_API_KEY;
  if (!base || !key) throw new Error("Model provider is not configured");
  const model = process.env.ICON_PLANNER_MODEL || process.env.ICON_SVG_MODEL || "gpt-5.6-sol";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SUBJECT_BLUEPRINT_PROMPT },
        { role: "user", content: JSON.stringify({ requestedSubject: subject }) },
      ],
    }),
    signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(options.timeoutMs ?? 120_000)]),
  });
  if (!response.ok) throw new Error(`Subject blueprint provider failed: ${response.status}`);
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content ?? "";
  return subjectStructureBlueprintSchema.parse(JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
}

export function subjectBlueprintInstruction(blueprint: SubjectStructureBlueprint) {
  return `SUBJECT STRUCTURE BLUEPRINT v1:\n${JSON.stringify(blueprint)}\nThis blueprint is the cross-style source of truth for semantic anatomy, not executable or numerically locked geometry. Preserve semantic part identity, count, attachment roots and identity-bearing openings. Surface-mark counts are not semantic part counts: if a blueprint names too many stripes, veins, seams or spots for 24px, reduce or simplify them until retained marks have clear ink-to-ink spacing, while preserving their orientation and identity role. Do not turn packed line art into an apparent solid mass. Its viewpoint and proportions describe the canonical reference, not a ban on projection: isometric styles must apply one consistent projection to all related parts; pixel styles must rebuild on their grid. Preserve anatomical relationships while adapting visible silhouettes and occlusion to that projection. Do not preserve hidden edges or distort parts independently. Style-specific construction takes precedence over canonical screen coordinates, never over subject identity; never substitute a generic shell, shield, smile, ring stack or unrelated primitive composition. The rendered icon must remain identifiable without its name or colors.`;
}
