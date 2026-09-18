import { z } from "zod";

export const styleReferenceReviewSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(0).max(100),
  recognizedSubject: z.string().trim().min(1).max(240),
  recognizabilityScore: z.number().min(0).max(100),
  structureScore: z.number().min(0).max(100),
  styleScore: z.number().min(0).max(100),
  matchedTraits: z.array(z.string().trim().min(1).max(240)).max(8),
  issues: z.array(z.string().trim().min(1).max(240)).max(8),
  correction: z.string().trim().max(800),
});

export type StyleReferenceReview = z.infer<typeof styleReferenceReviewSchema>;

export const STYLE_REFERENCE_REVIEW_PROMPT = `You are a strict UI icon art director and recognizability gate. The first image is a style reference only; never copy or evaluate its subject. The second image is the generated production icon. Judge that generated image without relying on a caption, filename, color name or explanatory text.
Return only JSON: {"pass":boolean,"score":number,"recognizedSubject":string,"recognizabilityScore":number,"structureScore":number,"styleScore":number,"matchedTraits":string[],"issues":string[],"correction":string}.

First identify what physical object, action or conventional UI symbol the generated image actually resembles. Compare recognizedSubject against requestedSubject. A loose category match is insufficient when the request names a concrete object or variant. Check that its canonical outer contour, identity-bearing parts, part count, relative proportions, symmetry class, negative spaces, attachments and operating mechanism are visibly present. Color differences cannot substitute for missing structure.

Then inspect production construction and reference-style fidelity: optical stroke or structural thickness, cap/join treatment, corner-radius family, curve continuity, geometric regularity, paired-part alignment, silhouette discipline, intentional internal spacing, detail density, visual weight, color treatment and overall UI-icon character.

Fail immediately when the icon cannot be identified as the requested subject without its label; resembles a neighboring object instead; is an abstract blob; uses color to imply parts absent from the geometry; has accidental asymmetry, unequal paired parts, pinched curves, melted attachments, floating components, accidental gaps, stacked primitives, generic rounded rectangles, irregular geometry, arbitrary bulges or a construction that would collapse when rendered in one solid color.

pass may be true only when recognizabilityScore >= 88, structureScore >= 85, styleScore >= 82, the overall score >= 85, and there is no major semantic or structural mismatch. correction must name the misread object or missing identity features and give concise actionable redraw instructions. Preserve user intent; do not add decorative detail and do not ask to copy a specific icon from the reference board.`;

export function parseStyleReferenceReview(value: unknown) {
  return styleReferenceReviewSchema.parse(value);
}
