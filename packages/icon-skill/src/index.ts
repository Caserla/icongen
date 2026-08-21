import type { ColorSetting, CoreSettings, CreateGenerationJobInput } from "@icongen/shared";

export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.2.0";

const directions = [
  "Use the most familiar and immediately recognizable functional metaphor.",
  "Use an alternative metaphor while preserving the same action and visual system.",
  "Use a simplified composition variation with the same meaning and optical weight.",
] as const;

export type CompileIconPromptInput = {
  name: string;
  description: string;
  color: ColorSetting;
  background: CreateGenerationJobInput["background"];
  coreSettings: CoreSettings;
  sizes: number[];
  slot: 1 | 2 | 3;
};

const describeColor = (color: ColorSetting) => color.mode === "solid"
  ? `solid ${color.color}`
  : `gradient ${color.colors.join(" to ")} ${color.direction}`;

export function compileIconPrompt(input: CompileIconPromptInput) {
  const direction = directions[input.slot - 1];
  const background = input.background.enabled
    ? `${input.background.container} background using ${describeColor(input.background.color)}`
    : "transparent background";

  return {
    skillVersion: ICON_SKILL_VERSION,
    direction,
    prompt: [
      "Create one original production UI function icon, not an App Store app icon.",
      `Function name: ${input.name}.`,
      `Function meaning: ${input.description}.`,
      `Variant direction: ${direction}`,
      `Graphic structure: ${input.coreSettings.graphicStructure}. Visual tone: ${input.coreSettings.visualTone}.`,
      `Stroke weight: ${input.coreSettings.strokeWeight}. Color mode: ${input.coreSettings.colorMode}.`,
      `Subject color: ${describeColor(input.color)}. Background: ${background}.`,
      `Detail level: ${input.coreSettings.detailLevel}. Smallest target size: ${Math.min(...input.sizes)}px.`,
      "Use a front orthographic flat UI glyph with no shadow. Keep line weight, corner language, palette, view, and optical scale consistent across the batch.",
      "Compose a single centered icon only, never a grid, collection, mockup, phone screen, app icon tile, or presentation board.",
      "Do not include text, letters, watermarks, existing brand marks, protected characters, or unrelated decoration.",
      "Return a square PNG-ready icon with crisp edges and safe padding.",
    ].join("\n"),
  };
}
