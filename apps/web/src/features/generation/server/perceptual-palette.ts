import type { ProjectTheme } from "../project-themes";
import { colorPlanCompatibility, createSmartColorPlan } from "./smart-color-plan";
export { toOklab, toLch, perceptualDistance, oklchHex, contrastRatio } from "./color-math";

/** Compatibility facade: complete recipe selection replaces project-hue averaging. */
export function perceptualStylePalette(theme: ProjectTheme | undefined, styleId: string, surface: "light" | "dark"): ProjectTheme {
  return colorPlanCompatibility(createSmartColorPlan({ styleId, theme: surface, projectColors: theme ? Object.values(theme) : [] }));
}
