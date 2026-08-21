import { z } from "zod";
import { DESIGN_SETTINGS_VERSION } from "./design-settings";

export const VARIANTS_PER_SUBJECT = 3 as const;
export const MAX_SUBJECTS_PER_JOB = 20 as const;
export const OUTPUT_SIZES = [16, 20, 24, 32, 48, 64, 128, 256, 512, 1024] as const;

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Expected a #RRGGBB color");
const gradientDirectionSchema = z.enum([
  "top-to-bottom", "bottom-to-top", "left-to-right", "right-to-left",
  "top-left-to-bottom-right", "top-right-to-bottom-left", "radial",
]);

export const colorSettingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("solid"), color: hexColorSchema }),
  z.object({ mode: z.literal("gradient"), colors: z.tuple([hexColorSchema, hexColorSchema]), direction: gradientDirectionSchema }),
]);

export const coreSettingsSchema = z.object({
  graphicStructure: z.enum(["outline", "filled", "line-fill", "duotone"]),
  visualTone: z.enum(["neutral", "rounded", "bold", "playful", "technical"]),
  strokeWeight: z.enum(["light", "regular", "medium", "bold"]),
  colorMode: z.enum(["monochrome", "two-tone", "multicolor", "gradient"]),
  backgroundContainer: z.enum(["none", "circle", "square", "rounded-square", "pill"]),
  detailLevel: z.enum(["auto", "minimal", "standard"]),
});

export const generationSubjectInputSchema = z.object({
  clientId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().min(2).max(300),
  colorOverride: colorSettingSchema.optional(),
});

const outputSizeSchema = z.union(OUTPUT_SIZES.map((size) => z.literal(size)));

export const createGenerationJobSchema = z.object({
  idempotencyKey: z.string().uuid(),
  settingsVersion: z.literal(DESIGN_SETTINGS_VERSION),
  subjects: z.array(generationSubjectInputSchema).min(1).max(MAX_SUBJECTS_PER_JOB),
  subjectColor: colorSettingSchema,
  background: z.discriminatedUnion("enabled", [
    z.object({ enabled: z.literal(false) }),
    z.object({
      enabled: z.literal(true),
      container: z.enum(["circle", "square", "rounded-square", "pill"]),
      color: colorSettingSchema,
    }),
  ]),
  coreSettings: coreSettingsSchema,
  sizes: z.array(outputSizeSchema).min(1).max(OUTPUT_SIZES.length),
}).superRefine((value, context) => {
  if (new Set(value.subjects.map((subject) => subject.clientId)).size !== value.subjects.length) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Subject clientId values must be unique" });
  }
  if (new Set(value.sizes).size !== value.sizes.length) {
    context.addIssue({ code: "custom", path: ["sizes"], message: "Output sizes must be unique" });
  }
  if (!value.background.enabled && value.coreSettings.backgroundContainer !== "none") {
    context.addIssue({ code: "custom", path: ["coreSettings", "backgroundContainer"], message: "Background container must be none when background is disabled" });
  }
  if (value.background.enabled && value.coreSettings.backgroundContainer === "none") {
    context.addIssue({ code: "custom", path: ["coreSettings", "backgroundContainer"], message: "Choose a container when background is enabled" });
  }
});

export type CreateGenerationJobInput = z.infer<typeof createGenerationJobSchema>;
export type GenerationSubjectInput = z.infer<typeof generationSubjectInputSchema>;
export type CoreSettings = z.infer<typeof coreSettingsSchema>;
export type ColorSetting = z.infer<typeof colorSettingSchema>;

export const generationJobStatusV2Schema = z.enum(["queued", "processing", "completed", "partial", "failed"]);
export const generationSubjectStatusSchema = z.enum(["queued", "processing", "completed", "partial", "failed"]);
export const generationVariantStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);
export const generationProgressPhaseSchema = z.enum(["queued", "compiling", "generating", "processing-assets", "saving", "completed"]);

export const generationAssetSchema = z.object({
  id: z.string().uuid(),
  size: outputSizeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hasAlpha: z.boolean(),
  previewUrl: z.string().url().optional(),
});

export const generationVariantSchema = z.object({
  id: z.string().uuid(),
  slot: z.number().int().min(1).max(VARIANTS_PER_SUBJECT),
  status: generationVariantStatusSchema,
  isPrimary: z.boolean(),
  assets: z.array(generationAssetSchema),
  errorCode: z.string().optional(),
});

export const generationSubjectSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  name: z.string(),
  description: z.string(),
  position: z.number().int().nonnegative(),
  status: generationSubjectStatusSchema,
  variants: z.array(generationVariantSchema).length(VARIANTS_PER_SUBJECT),
  creditRefunded: z.boolean(),
});

export const generationJobResponseSchema = z.object({
  id: z.string().uuid(),
  status: generationJobStatusV2Schema,
  settingsVersion: z.string(),
  skillVersion: z.string().optional(),
  model: z.string().optional(),
  progress: z.object({
    percent: z.number().int().min(0).max(100),
    phase: generationProgressPhaseSchema,
    completedSubjects: z.number().int().nonnegative(),
    totalSubjects: z.number().int().positive(),
    currentSubjectName: z.string().optional(),
  }),
  creditSummary: z.object({ charged: z.number().int().nonnegative(), refunded: z.number().int().nonnegative() }),
  subjects: z.array(generationSubjectSchema),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type GenerationJobV2 = z.infer<typeof generationJobResponseSchema>;
export type GenerationJobStatusV2 = z.infer<typeof generationJobStatusV2Schema>;

export const generationQueueMessageV2Schema = z.object({
  version: z.literal(2),
  jobId: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

export type GenerationQueueMessageV2 = z.infer<typeof generationQueueMessageV2Schema>;

export const generationSettingsResponseSchema = z.object({
  version: z.string().min(1),
  groups: z.array(z.object({
    id: z.string().min(1),
    label: z.object({ en: z.string().min(1), zh: z.string().min(1) }),
    options: z.array(z.object({
      id: z.string().min(1),
      label: z.object({ en: z.string().min(1), zh: z.string().min(1) }),
      promptToken: z.string().min(1),
    })).min(1),
  })).length(6),
  outputSizes: z.array(outputSizeSchema).length(OUTPUT_SIZES.length),
  limits: z.object({ maxSubjectsPerJob: z.literal(MAX_SUBJECTS_PER_JOB), variantsPerSubject: z.literal(VARIANTS_PER_SUBJECT) }),
});
export type GenerationSettingsResponse = z.infer<typeof generationSettingsResponseSchema>;

export const generationErrorCodeSchema = z.enum([
  "VALIDATION_ERROR", "SETTINGS_VERSION_EXPIRED", "INSUFFICIENT_CREDITS",
  "ACTIVE_JOB_LIMIT_REACHED", "CONTENT_POLICY_BLOCKED", "GENERATION_QUEUE_FAILED",
  "GENERATION_PARTIAL", "NO_RESULTS_SELECTED", "DOWNLOAD_NOT_READY", "RESOURCE_FORBIDDEN",
]);
