import { z } from "zod";

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_IMAGE_MODEL: z.string().min(1).default("gpt-image-2"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ICON_BUCKET: z.string().min(1).default("generated-icons"),
  GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
});

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(): WorkerConfig {
  return configSchema.parse(process.env);
}
