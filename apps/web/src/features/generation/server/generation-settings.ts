import {
  DESIGN_SETTINGS_VERSION,
  ICON_STYLE_PRESETS,
  MAX_SUBJECTS,
  OUTPUT_SIZES,
  STYLE_ADJUSTMENT_GROUPS,
  VARIANTS_PER_SUBJECT,
  generationSettingsResponseSchema,
  type GenerationSettingsResponse,
  validateIconStyleCatalog,
} from "@icongen/shared";

export function getGenerationSettings(): GenerationSettingsResponse {
  // Keep the public catalog sourced from the shared, versioned preset contract.
  const validation = validateIconStyleCatalog();
  if (!validation.valid)
    throw new Error(
      `Invalid icon style catalog: ${validation.errors.join(", ")}`,
    );
  return generationSettingsResponseSchema.parse({
    version: DESIGN_SETTINGS_VERSION,
    stylePresets: ICON_STYLE_PRESETS,
    styleAdjustments: STYLE_ADJUSTMENT_GROUPS,
    outputSizes: OUTPUT_SIZES,
    limits: {
      maxSubjects: MAX_SUBJECTS,
      maxOutputSizes: 3,
      variantsPerSubject: VARIANTS_PER_SUBJECT,
    },
  });
}
