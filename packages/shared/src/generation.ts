import { z } from "zod";

export const generationStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export type GenerationStatus = z.infer<typeof generationStatusSchema>;

export const createGenerationSchema = z.object({
  description: z.string().trim().min(10).max(1000),
  stylePreset: z.string().trim().max(64).optional(),
});

export type CreateGenerationInput = z.infer<typeof createGenerationSchema>;

export type GenerationResult = {
  id: string;
  imageUrl: string;
  downloadUrl?: string;
};

export type GenerationJob = {
  id: string;
  description: string;
  status: GenerationStatus;
  createdAt: string;
  results: GenerationResult[];
};

export const generationQueueMessageSchema = z.object({
  version: z.literal(1),
  jobId: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

export type GenerationQueueMessage = z.infer<typeof generationQueueMessageSchema>;
