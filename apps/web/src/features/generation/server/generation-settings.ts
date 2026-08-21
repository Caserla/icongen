import { CORE_SETTING_GROUPS, DESIGN_SETTINGS_VERSION, MAX_SUBJECTS_PER_JOB, OUTPUT_SIZES, VARIANTS_PER_SUBJECT, generationSettingsResponseSchema, type GenerationSettingsResponse, validateCoreSettingsCatalog } from "@icongen/shared";

export function getGenerationSettings(): GenerationSettingsResponse {
  const validation = validateCoreSettingsCatalog();
  if (!validation.valid) throw new Error(`Invalid design settings catalog: ${validation.errors.join(", ")}`);
  return generationSettingsResponseSchema.parse({ version: DESIGN_SETTINGS_VERSION, groups: CORE_SETTING_GROUPS, outputSizes: OUTPUT_SIZES, limits: { maxSubjectsPerJob: MAX_SUBJECTS_PER_JOB, variantsPerSubject: VARIANTS_PER_SUBJECT } });
}
