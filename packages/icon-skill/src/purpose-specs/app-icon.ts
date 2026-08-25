import { APP_ICON_CANVAS_SPEC, SHARED_PRODUCTION_BOUNDARIES } from "../production-boundaries";
import { getAppIconStyleSpec } from "../style-specs/app-icon-styles";
import type { CompileIconPromptInput } from "../types";

export function compileAppIconPrompt(input: CompileIconPromptInput, direction: string, fallbackStyle: string) {
  const styleSpec = getAppIconStyleSpec(input.style.preset, fallbackStyle);
  return [
    "USE CASE\nproduction-app-icon",
    "TASK\nCreate exactly one original production app icon for a home screen, launcher, and app store.",
    `SUBJECT\nApp concept: ${input.name}\nMeaning: ${input.description}`,
    `STYLE SPEC\n${styleSpec}`,
    `VARIANT\n${direction}`,
    `SIZE AND LEGIBILITY\nReference sizes: ${input.sizes.join(", ")}px. Smallest target: ${Math.min(...input.sizes)}px. Preserve a memorable silhouette and simplify detail for the smallest target.`,
    `PRODUCTION BOUNDARY\n${APP_ICON_CANVAS_SPEC} ${SHARED_PRODUCTION_BOUNDARIES}`,
    "OUTPUT\nReturn one crisp square PNG-ready production app-icon asset with an opaque background.",
  ].join("\n\n");
}
