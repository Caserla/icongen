import { z } from "zod";
import { validateRuntimeEnvironment } from "@icongen/shared";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const configSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "preproduction", "production"]),
    SUPABASE_ENVIRONMENT: z.enum([
      "development",
      "test",
      "preproduction",
      "production",
    ]),
    IMAGE_PROVIDER: z.enum(["mock", "openai"]).default("mock"),
    IMAGE_MODEL: z.string().min(1).default("gpt-image-2"),
    IMAGE_QUALITY: z.enum(["low", "medium", "high", "auto"]).default("high"),
    IMAGE_SIZE: z.enum(["1024x1024", "2048x2048"]).default("2048x2048"),
    IMAGE_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(30_000)
      .max(600_000)
      .default(240_000),
    IMAGE_REQUEST_MAX_RETRIES: z.coerce.number().int().min(0).max(2).default(0),
    IMAGE_PROVIDER_BASE_URL: optionalUrl,
    IMAGE_PROVIDER_API_KEY: z.string().min(1).optional(),
    ICON_SKILL: z.string().min(1).default("default-ui-icon"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SUPABASE_ICON_BUCKET: z.string().min(1).default("generated-icons"),
    GENERATION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    GENERATION_CONCURRENCY: z.coerce.number().int().min(1).max(3).default(3),
  })
  .superRefine((config, context) => {
    if (config.IMAGE_PROVIDER === "openai" && !config.IMAGE_PROVIDER_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["IMAGE_PROVIDER_API_KEY"],
        message: "API key is required for OpenAI",
      });
    }
  });

export type WorkerConfig = z.infer<typeof configSchema>;

export function loadConfig(): WorkerConfig {
  const config = configSchema.parse(process.env);
  validateRuntimeEnvironment({
    appEnvironment: config.APP_ENV,
    resourceEnvironment: config.SUPABASE_ENVIRONMENT,
    imageProvider: config.IMAGE_PROVIDER,
  });
  return config;
}
