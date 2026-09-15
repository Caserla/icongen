import type { CompileIconPromptInput } from "../types";

/** Shared brand semantics used before any of the nine visual-style protocols. */
export function compileBrandIllustrationSubject(input: CompileIconPromptInput) {
  const description = input.description.trim();
  const suppliedSubject = description.startsWith(input.name.trim())
    ? description
    : `${input.name}\n${description}`;

  return [
    "BRAND ILLUSTRATION VERTICAL",
    "Design one distinctive brand illustration, not a generic decorative illustration or a standalone abstract logo mark.",
    "Translate the brand's real product, service, industry, or core functional benefit into one immediately recognizable principal motif. The motif may be a relevant product, tool, object, mechanism, animal, plant, or other concrete symbol only when its relationship to the brand is clear.",
    "Integrate the supplied full brand name or existing logo as a deliberate, legible brand element when provided. Do not invent an unrelated initial, monogram, mascot, badge, or symbol merely to fill space.",
    "Keep one clear visual idea, a memorable silhouette, and strong recognition at icon size. Supporting elements must explain the product function and remain subordinate to the principal motif.",
    `BRAND INPUT\n${suppliedSubject}`,
  ].join("\n");
}
