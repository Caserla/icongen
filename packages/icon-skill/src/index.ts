import { ICON_STYLE_PRESETS } from "@icongen/shared";
import { compileAppIconPrompt } from "./purpose-specs/app-icon";
import { compileFlatPlayfulAppIconPrompt } from "./purpose-specs/flat-playful-app-icon";
import { compileInteractionPrompt } from "./purpose-specs/interaction";
import type { CompileIconPromptInput } from "./types";
import { VARIANT_DIRECTIONS } from "./variant-directions";
import { getConfiguredBackgroundQualityContract } from "./background-contracts";
import { appIconRequestsNoBackground } from "./purpose-specs/production-app-icon-template";

export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.8.10";

export type { CompileIconPromptInput } from "./types";

export function compileIconPrompt(input: CompileIconPromptInput) {
  const direction = VARIANT_DIRECTIONS[input.slot - 1];
  const preset = ICON_STYLE_PRESETS.find(
    (item) => item.id === input.style.preset,
  );
  const prompt =
    input.purpose === "app-icon" && input.style.preset === "flat-playful"
      ? compileFlatPlayfulAppIconPrompt(input, direction)
      : input.purpose === "app-icon"
        ? compileAppIconPrompt(
            input,
            direction,
            preset?.promptToken ?? input.style.preset,
          )
        : compileInteractionPrompt(input, direction);
  const requestsNoBackground =
    input.purpose === "app-icon" && appIconRequestsNoBackground(input);
  const hasBackground = input.background.enabled && !requestsNoBackground;

  return {
    skillVersion: ICON_SKILL_VERSION,
    direction,
    prompt,
    qualityContract:
      input.purpose === "app-icon" && hasBackground
        ? getConfiguredBackgroundQualityContract(
            input.style.preset,
            input.background,
            input.slot,
          )
        : undefined,
    outputBackground: hasBackground
      ? ("opaque" as const)
      : ("transparent" as const),
  };
}
