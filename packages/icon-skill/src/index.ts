import { compileAppIconPrompt } from "./purpose-specs/app-icon";
import { compileInteractionPrompt } from "./purpose-specs/interaction";
import type { CompileIconPromptInput } from "./types";
import { VARIANT_DIRECTIONS } from "./variant-directions";
import { getConfiguredBackgroundQualityContract } from "./background-contracts";
import { appIconRequestsNoBackground } from "./purpose-specs/production-app-icon-template";
import { getApprovedStyleReferenceAssetUrl } from "./style-specs/approved-style-references";
import { getIconGeometryContract } from "./geometry-contracts";

export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.10.0";

export type { CompileIconPromptInput } from "./types";

export function compileIconPrompt(input: CompileIconPromptInput) {
  const direction = VARIANT_DIRECTIONS[input.slot - 1];
  const prompt =
    input.purpose === "app-icon"
        ? compileAppIconPrompt(input, direction)
        : compileInteractionPrompt(input, direction);
  const requestsNoBackground =
    input.purpose === "app-icon" && appIconRequestsNoBackground(input);
  const hasBackground = input.background.enabled && !requestsNoBackground;

  return {
    skillVersion: ICON_SKILL_VERSION,
    direction,
    prompt,
    geometryContract: getIconGeometryContract(input),
    referenceImageAssetUrl:
      input.purpose === "app-icon"
        ? getApprovedStyleReferenceAssetUrl(input.style.preset)
        : undefined,
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
