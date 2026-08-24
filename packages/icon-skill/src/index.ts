import { ICON_STYLE_PRESETS, type ColorSetting, type CreateGenerationJobInput, type IconStyle } from "@icongen/shared";

export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.2.0";

const directions = [
  "Use the most familiar and immediately recognizable functional metaphor.",
  "Use an alternative metaphor while preserving the same action and visual system.",
  "Use a simplified composition variation with the same meaning and optical weight.",
] as const;

export type CompileIconPromptInput = {
  purpose?: CreateGenerationJobInput["purpose"];
  name: string;
  description: string;
  color: ColorSetting;
  background: CreateGenerationJobInput["background"];
  style: IconStyle;
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
  const preset = ICON_STYLE_PRESETS.find((item) => item.id === input.style.preset);

  return {
    skillVersion: ICON_SKILL_VERSION,
    direction,
    prompt: [
      input.purpose === "app-icon"
        ? "Create one original production app icon for home screens, launchers, and app stores."
        : "Create one original production UI function icon, not an App Store app icon.",
      `Function name: ${input.name}.`,
      `Function meaning: ${input.description}.`,
      `Variant direction: ${direction}`,
      `Icon style preset: ${preset?.promptToken ?? input.style.preset}.`,
      `Graphic structure: ${input.style.graphicStructure === "filled" ? "filled solid glyph with clear negative space" : "linear outline glyph with no fill"}.`,
      `Style refinements: ${input.style.strokeWeight} line weight; ${input.style.cornerStyle} corner language; ${input.style.detailLevel} detail density.`,
      `Subject color: ${describeColor(input.color)}. Background: ${background}.`,
      `Smallest target size: ${Math.min(...input.sizes)}px; simplify visual details and preserve optical clarity at this size.`,
      "Honor the selected style preset's material, dimensionality, camera, lighting, edge treatment, and rendering language. Keep those choices, line weight, corner language, palette, and optical scale consistent across the batch.",
      "Compose a single centered icon only, never a grid, collection, mockup, phone screen, app icon tile, or presentation board.",
      "Do not include text, letters, watermarks, existing brand marks, protected characters, or unrelated decoration.",
      "Return a square PNG-ready icon with crisp edges and safe padding.",
    ].join("\n"),
  };
}
