import { z } from "zod";
import {
  DESIGN_SETTINGS_VERSION,
  ICON_STYLE_PRESET_IDS,
} from "./design-settings";

export const VARIANTS_PER_SUBJECT = 3 as const;
export const MAX_SUBJECTS = 20 as const;
export const OUTPUT_SIZES = [16, 32, 48, 64, 128, 256] as const;
export const DEFAULT_SUBJECT_SIZE_PERCENT = 70 as const;
export const DEFAULT_LINEAR_STROKE_WIDTH_PERCENT = 3.5 as const;
const LEGACY_OUTPUT_SIZES = [
  16, 20, 24, 32, 48, 64, 128, 256, 512, 1024,
] as const;

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Expected a #RRGGBB color");
const gradientDirectionSchema = z.enum([
  "top-to-bottom",
  "bottom-to-top",
  "left-to-right",
  "right-to-left",
  "top-left-to-bottom-right",
  "top-right-to-bottom-left",
  "radial",
]);
export const colorSettingSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("solid"), color: hexColorSchema }),
  z.object({
    mode: z.literal("gradient"),
    colors: z.tuple([hexColorSchema, hexColorSchema]),
    direction: gradientDirectionSchema,
  }),
]);
export const iconStyleSchema = z.object({
  preset: z.enum(ICON_STYLE_PRESET_IDS),
  graphicStructure: z.enum(["linear", "filled"]).optional(),
  subjectSizePercent: z.number().int().min(50).max(85).default(DEFAULT_SUBJECT_SIZE_PERCENT),
  linearStrokeWidthPercent: z.number().min(2).max(6).default(DEFAULT_LINEAR_STROKE_WIDTH_PERCENT),
  strokeWeight: z.enum(["light", "regular", "bold"]),
  cornerStyle: z.enum(["soft", "balanced", "sharp"]),
  detailLevel: z.enum(["minimal", "standard", "detailed"]),
});
const backgroundSettingSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    container: z.enum(["rounded-square", "circle", "square"]),
    color: colorSettingSchema,
    autoColor: z.boolean().optional(),
    cornerRadius: z.number().int().min(0).max(50).optional(),
  }),
]);
export const generationSubjectInputSchema = z.object({
  clientId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(300),
  colorOverride: colorSettingSchema.optional(),
  backgroundOverride: backgroundSettingSchema.optional(),
});
const outputSizeSchema = z.union(OUTPUT_SIZES.map((size) => z.literal(size)));
const legacyOutputSizeSchema = z.union(
  LEGACY_OUTPUT_SIZES.map((size) => z.literal(size)),
);

export const createGenerationJobSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    settingsVersion: z.literal(DESIGN_SETTINGS_VERSION),
    purpose: z.enum(["interaction", "app-icon"]).optional(),
    subjects: z.array(generationSubjectInputSchema).min(1).max(MAX_SUBJECTS),
    subjectColor: colorSettingSchema,
    background: backgroundSettingSchema,
    style: iconStyleSchema,
    sizes: z.array(outputSizeSchema).min(1).max(3),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.subjects.map((subject) => subject.clientId)).size !==
      value.subjects.length
    )
      context.addIssue({
        code: "custom",
        path: ["subjects"],
        message: "Subject clientId values must be unique",
      });
    if (new Set(value.sizes).size !== value.sizes.length)
      context.addIssue({
        code: "custom",
        path: ["sizes"],
        message: "Output sizes must be unique",
      });
  });

// Existing queued jobs keep their stored specification. Convert the previous user-facing
// parameters to the nearest coherent preset when the worker reads those jobs.
const legacyGenerationJobSchema = z.object({
  idempotencyKey: z.string().uuid(),
  settingsVersion: z.literal("core-settings-2026-08-20.1"),
  subjects: z.array(generationSubjectInputSchema).min(1),
  subjectColor: colorSettingSchema,
  background: z.discriminatedUnion("enabled", [
    z.object({ enabled: z.literal(false) }),
    z.object({
      enabled: z.literal(true),
      container: z.enum(["rounded-square", "circle", "square"]),
      color: colorSettingSchema,
    }),
  ]),
  coreSettings: z.object({
    graphicStructure: z.enum(["outline", "filled", "line-fill", "duotone"]),
    visualTone: z.enum(["neutral", "rounded", "bold", "playful", "technical"]),
    strokeWeight: z.enum(["light", "regular", "medium", "bold"]),
    colorMode: z.enum(["monochrome", "two-tone", "multicolor", "gradient"]),
    backgroundContainer: z.enum([
      "none",
      "circle",
      "square",
      "rounded-square",
      "pill",
    ]),
    detailLevel: z.enum(["auto", "minimal", "standard"]),
  }),
  sizes: z.array(legacyOutputSizeSchema).min(1).max(3),
});

export function parseStoredGenerationJobSpec(
  value: unknown,
): CreateGenerationJobInput {
  const current = createGenerationJobSchema.safeParse(value);
  if (current.success) return current.data;
  const legacy = legacyGenerationJobSchema.parse(value);
  const preset =
    legacy.coreSettings.graphicStructure === "filled"
      ? "solid-glyph"
      : legacy.coreSettings.graphicStructure === "duotone"
        ? "duotone-layered"
        : legacy.coreSettings.visualTone === "bold"
          ? "bold-geometric"
          : legacy.coreSettings.visualTone === "rounded" ||
              legacy.coreSettings.visualTone === "playful"
            ? "rounded-outline"
            : "minimal-logo";
  return {
    idempotencyKey: legacy.idempotencyKey,
    settingsVersion: DESIGN_SETTINGS_VERSION,
    subjects: legacy.subjects,
    subjectColor: legacy.subjectColor,
    background: legacy.background,
    style: {
      preset:
        preset === "solid-glyph"
          ? "minimal-logo"
          : preset === "duotone-layered"
            ? "flat-illustration"
            : preset === "bold-geometric"
              ? "low-poly"
              : preset === "rounded-outline"
                ? "cute-sticker"
                : "minimal-logo",
      strokeWeight:
        legacy.coreSettings.strokeWeight === "medium"
          ? "regular"
          : legacy.coreSettings.strokeWeight,
      cornerStyle:
        legacy.coreSettings.visualTone === "rounded" ||
        legacy.coreSettings.visualTone === "playful"
          ? "soft"
          : legacy.coreSettings.visualTone === "technical"
            ? "sharp"
            : "balanced",
      detailLevel:
        legacy.coreSettings.detailLevel === "auto"
          ? "standard"
          : legacy.coreSettings.detailLevel,
      subjectSizePercent: DEFAULT_SUBJECT_SIZE_PERCENT,
      linearStrokeWidthPercent: DEFAULT_LINEAR_STROKE_WIDTH_PERCENT,
    },
    // Legacy jobs retain their stored sizes even when those sizes are no longer offered by the current UI.
    sizes: legacy.sizes as CreateGenerationJobInput["sizes"],
  };
}

export type CreateGenerationJobInput = z.infer<
  typeof createGenerationJobSchema
>;
export type GenerationSubjectInput = z.infer<
  typeof generationSubjectInputSchema
>;
export type IconStyle = z.infer<typeof iconStyleSchema>;
export type ColorSetting = z.infer<typeof colorSettingSchema>;
export const generationJobStatusV2Schema = z.enum([
  "queued",
  "processing",
  "completed",
  "partial",
  "failed",
]);
export const generationSubjectStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "partial",
  "failed",
]);
export const generationVariantStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);
export const generationProgressPhaseSchema = z.enum([
  "queued",
  "compiling",
  "generating",
  "processing-assets",
  "saving",
  "completed",
]);
export const generationAssetFormatSchema = z.enum(["png", "svg"]);
export const generationAssetSchema = z.object({
  id: z.string().uuid(),
  assetRole: z.literal("output").default("output"),
  format: generationAssetFormatSchema.default("png"),
  size: z.number().int().positive(),
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
  previewUrl: z.string().url().optional(),
  vectorUrl: z.string().url().optional(),
  activeRevisionId: z.string().uuid().optional(),
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
});
export const generationJobResponseSchema = z.object({
  id: z.string().uuid(),
  supportsVariantEditing: z.boolean().default(false),
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
  subjects: z.array(generationSubjectSchema),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type GenerationJobV2 = z.infer<typeof generationJobResponseSchema>;
export type GenerationJobStatusV2 = z.infer<typeof generationJobStatusV2Schema>;
const labelSchema = z.object({ en: z.string().min(1), zh: z.string().min(1) });
const optionSchema = z.object({
  id: z.string().min(1),
  label: labelSchema,
  promptToken: z.string().min(1),
});
export const generationSettingsResponseSchema = z.object({
  version: z.string().min(1),
  stylePresets: z
    .array(
      optionSchema.extend({
        description: labelSchema,
        previewImage: z.string().startsWith("/"),
      }),
    )
    .length(10),
  styleAdjustments: z
    .array(
      z.object({
        id: z.string().min(1),
        label: labelSchema,
        options: z.array(optionSchema).min(1),
      }),
    )
    .length(3),
  outputSizes: z.array(outputSizeSchema).length(OUTPUT_SIZES.length),
  limits: z.object({
    maxSubjects: z.literal(MAX_SUBJECTS),
    maxOutputSizes: z.literal(3),
    variantsPerSubject: z.literal(VARIANTS_PER_SUBJECT),
  }),
});
export type GenerationSettingsResponse = z.infer<
  typeof generationSettingsResponseSchema
>;
export const markPrimaryVariantSchema = z.object({
  variantId: z.string().uuid(),
});
export const createGenerationDownloadSchema = z
  .object({
    variantIds: z.array(z.string().uuid()).min(1),
    format: generationAssetFormatSchema.default("png"),
    size: outputSizeSchema.optional(),
    includeSvg: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (new Set(value.variantIds).size !== value.variantIds.length)
      context.addIssue({
        code: "custom",
        path: ["variantIds"],
        message: "Variant IDs must be unique",
      });
  });
export const generationErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "SETTINGS_VERSION_EXPIRED",
  "ACTIVE_JOB_LIMIT_REACHED",
  "CONTENT_POLICY_BLOCKED",
  "GENERATION_QUEUE_FAILED",
  "GENERATION_PARTIAL",
  "NO_RESULTS_SELECTED",
  "DOWNLOAD_NOT_READY",
  "RESOURCE_FORBIDDEN",
]);
