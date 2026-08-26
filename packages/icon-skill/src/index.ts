import { ICON_STYLE_PRESETS } from "@icongen/shared";
import { compileAppIconPrompt } from "./purpose-specs/app-icon";
import { compileInteractionPrompt } from "./purpose-specs/interaction";
import type { CompileIconPromptInput } from "./types";
import { VARIANT_DIRECTIONS } from "./variant-directions";

export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.5.1";

export type { CompileIconPromptInput } from "./types";

export function compileIconPrompt(input: CompileIconPromptInput) {
  const direction = VARIANT_DIRECTIONS[input.slot - 1];
  const preset = ICON_STYLE_PRESETS.find((item) => item.id === input.style.preset);
  const prompt = input.purpose === "app-icon"
    ? compileAppIconPrompt(input, direction, preset?.promptToken ?? input.style.preset)
    : compileInteractionPrompt(input, direction);

  return {
    skillVersion: ICON_SKILL_VERSION,
    direction,
    prompt,
  };
}
