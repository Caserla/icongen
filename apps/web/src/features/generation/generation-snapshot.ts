import { z } from "zod";
import { generationBriefSchema, generationStyleIds } from "./generation-intent";
import { isLegacyGenerationStyle } from "./legacy-generation-style-ids";
import { isLibraryGenerationStyle } from "./library-generation-styles";

// Explicit allowlist: shared by save and generation; don't strip the resolved brief.
export const generationSnapshotSchema = z.object({
  projectId: z.string().uuid(), projectName: z.string().max(200).optional(), projectDescription: z.string().max(6000).optional(),
  prompt: z.string().max(6000).optional(), locale: z.enum(["zh", "en"]).optional(),
  styleId: z.string().refine(value => generationStyleIds.includes(value) || isLegacyGenerationStyle(value), "Unknown style"),
  /** New sessions save six styles under each semantic subject, with Linear as the canvas thumbnail. */
  styleFamily: z.boolean().optional(),
  secondaryStyleId: z.string().refine(isLibraryGenerationStyle, "Unknown secondary style").optional(),
  colors: z.unknown().optional(), theme: z.enum(["light", "dark"]).default("light"),
  targetSurface: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), designBrief: generationBriefSchema.optional(),
  referenceImage: z.string().max(7_000_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
  referenceUse: z.enum(["none", "style", "subjects", "both"]).optional(),
});
export type GenerationSnapshot = z.infer<typeof generationSnapshotSchema>;
