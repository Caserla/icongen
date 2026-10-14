import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { librarySubjectPlanSchema } from "./library-six-plan";

const checkpointSchema = z.object({
  payload: z.string().max(900_000), signature: z.string().regex(/^[a-f0-9]{64}$/),
});
const contentSchema = z.object({
  stage: z.literal("planned"), inputHash: z.string(), expiresAt: z.number(),
  plan: librarySubjectPlanSchema,
  variants: z.record(z.string(), z.string().max(100_000)).optional(),
  measurements: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  outlineSource: z.string().max(100_000).optional(),
  calls: z.array(z.object({ stage: z.string(), model: z.string(), elapsedMs: z.number(), promptHash: z.string(), inputHash: z.string(), outcome: z.enum(["success", "provider-error"]) })).max(100),
});
type Content = z.infer<typeof contentSchema>;
const sign = (payload: string, key: string) => createHmac("sha256", key).update("library-plan-checkpoint-v1\n").update(payload).digest("hex");
export function createLibraryPlanCheckpoint(content: Omit<Content, "stage" | "expiresAt">, key: string) {
  const payload = JSON.stringify({ ...content, stage: "planned", expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return { payload, signature: sign(payload, key) };
}
export function readLibraryPlanCheckpoint(value: unknown, inputHash: string, key: string): Content | undefined {
  try {
    const { payload, signature } = checkpointSchema.parse(value);
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(payload, key), "hex"))) return;
    const content = contentSchema.parse(JSON.parse(payload));
    if (content.inputHash !== inputHash || content.expiresAt <= Date.now()) return;
    return content;
  } catch { return; }
}
