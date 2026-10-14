import { z } from "zod";
import { validateGeneratedSvg } from "./validate-generated-svg";
import { createHash } from "node:crypto";

const generationContext = z.object({ version: z.string(), protocolHash: z.string().regex(/^[a-f0-9]{64}$/), reviewStatus: z.enum(["model-reviewed", "rework-required", "pending"]), finalHashes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)) }).passthrough().refine(value => Buffer.byteLength(JSON.stringify(value)) <= 150_000, "Generation context too large");
const icon = z.object({ subjectId: z.string().min(1).max(80), svg: z.string().max(100_000), generationContext: generationContext.optional(), styleVariants: z.record(z.string(), z.string().max(100_000)).optional() });
export const iconSaveSchema = z.union([icon, z.object({ icons: z.array(icon).length(2) })]);
export function prepareIconSave(value: unknown, subjects: Array<{ id: string; name: string; description: string; state?: string; styleRole?: string }>) {
  const input = iconSaveSchema.parse(value);
  const icons = "icons" in input ? input.icons : [input];
  if (new Set(icons.map(item => item.subjectId)).size !== icons.length) throw new Error("Duplicate subject");
  const matched = icons.map(item => subjects.find(subject => subject.id === item.subjectId));
  if (matched.some(subject => !subject)) throw new Error("Subject not found in saved plan");
  if (matched.some(subject => subject?.state)) {
    const [first, second] = matched;
    if (icons.length !== 2 || !first || !second || first.name !== second.name || first.description !== second.description || new Set(matched.map(subject => subject?.state)).size !== 2 || !matched.every(subject => subject?.state === "outline" || subject?.state === "solid")) throw new Error("Both states of the same subject are required");
    const base = (id: string) => id.replace(/-(outline|solid)$/, "");
    if (/-(outline|solid)$/.test(first.id)) {
      if (base(first.id) !== base(second.id)) throw new Error("Pair mismatch");
    } else {
      const outline = matched.find(subject => subject?.state === "outline")!;
      const solid = matched.find(subject => subject?.state === "solid")!;
      if (subjects.indexOf(solid) !== subjects.indexOf(outline) + 1) throw new Error("Legacy pair mismatch");
    }
  } else if (icons.length === 2) {
    const [first, second] = matched;
    const base = (id: string) => id.replace(/-(main|secondary)$/, "");
    if (!first || !second || first.name !== second.name || first.description !== second.description
      || base(first.id) !== base(second.id) || new Set(matched.map(s => s?.styleRole)).size !== 2
      || !matched.every(s => s?.styleRole === "main" || s?.styleRole === "secondary")) throw new Error("Not a matching style pair");
  }
  return icons.map(item => {
    const svg = validateGeneratedSvg(item.svg);
    if (item.generationContext && !Object.values(item.generationContext.finalHashes).includes(createHash("sha256").update(svg).digest("hex"))) throw new Error("Generation review does not match this SVG");
    if (item.styleVariants) {
      if (!item.generationContext) throw new Error("Six-style family requires its review context");
      const variants = item.styleVariants;
      const styles = ["linear", "outline", "bold", "broken", "bulk", "twotone"];
      if (Object.keys(variants).length !== styles.length || styles.some(style => !variants[style])) throw new Error("Incomplete six-style family");
      for (const style of styles) {
        const verified = validateGeneratedSvg(variants[style]);
        if (item.generationContext.finalHashes[style] !== createHash("sha256").update(verified).digest("hex")) throw new Error(`Generation review does not match ${style}`);
      }
      if (variants.linear !== svg) throw new Error("Canvas preview must be the Linear variant");
    }
    return { subject_id: item.subjectId, svg, ...(item.generationContext ? { generation_context: item.generationContext } : {}), ...(item.styleVariants ? { style_variants: item.styleVariants } : {}) };
  });
}
