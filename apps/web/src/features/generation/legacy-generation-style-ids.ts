/** Read compatibility for existing 46-style project snapshots only. Never show
 * these IDs in the new generation menu or offer them to the planner. */
const LEGACY_GENERATION_STYLE_IDS = new Set([
  "thin", "light", "regular", "bold-outline", "broken-outline", "pure-solid", "cutout", "state-pair",
  "soft-rounded", "fully-rounded", "rounded-fill", "sharp", "angular", "grid-based",
  "outline-duotone", "filled-duotone", "two-color", "two-level", "three-level", "outline-fill",
  "semantic", "palette", "illustrative", "mono-pastel", "soft-two-tone", "background-tile",
  "gradient-outline", "gradient-fill", "radial", "multi-stop", "clay", "plastic", "extruded",
  "isometric", "frosted", "clear", "tinted", "sketch", "doodle", "colored-doodle",
  "pixel-outline", "pixel-solid", "pixel-color", "neon-tube", "soft-glow", "dual-neon",
]);

export function isLegacyGenerationStyle(value: string) { return LEGACY_GENERATION_STYLE_IDS.has(value); }
