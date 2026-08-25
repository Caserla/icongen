import { ICON_STYLE_PRESETS, type ColorSetting, type CreateGenerationJobInput, type IconStyle } from "@icongen/shared";

export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.4.0";

const variantDirections = [
  [
    "Concept A — canonical:",
    "Use the most familiar, direct symbol for the requested meaning.",
    "Favor a balanced front-facing silhouette, conventional proportions, and maximum recognition at a glance.",
    "Do not add secondary motifs or decorative cutouts.",
  ].join(" "),
  [
    "Concept B — structural alternative:",
    "Keep the requested meaning, but use a clearly different geometric construction from the canonical solution.",
    "Change the silhouette proportions, internal negative space, or arrangement of essential parts while remaining immediately recognizable.",
    "The result must read as a distinct design concept, not a minor redraw, rotation, color change, or stroke adjustment.",
  ].join(" "),
  [
    "Concept C — expressive simplification:",
    "Keep the requested meaning, but create a visibly distinct compact composition with a stronger signature silhouette.",
    "Use purposeful asymmetry, a different visual rhythm, or an inventive negative-space treatment where semantically appropriate.",
    "The result must not repeat the canonical front-facing construction and must differ in geometry, not merely rendering details.",
  ].join(" "),
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

const describeBackground = (background: CreateGenerationJobInput["background"]) => {
  if (!background.enabled) return "transparent canvas with a real alpha channel; no checkerboard and no simulated background";
  const shape = background.container === "rounded-square"
    ? `rounded-square container${background.cornerRadius === undefined ? "" : ` with a ${background.cornerRadius}% corner radius`}`
    : `${background.container} container`;
  return `${shape} filled with ${describeColor(background.color)}`;
};

function compileInteractionPrompt(input: CompileIconPromptInput, direction: string) {
  return [
    "TASK",
    "Create exactly one original production UI interaction icon. This is an in-app functional control, not an App Store or launcher icon.",
    "SUBJECT",
    `Name: ${input.name}`,
    `Meaning: ${input.description}`,
    "VISUAL SYSTEM",
    `Graphic structure: ${input.style.graphicStructure === "filled" ? "filled solid glyph with clear negative space" : "linear outline glyph with no fill"}.`,
    `Subject color: ${describeColor(input.color)}.`,
    `Icon background: ${describeBackground(input.background)}.`,
    "Use a clean contemporary UI icon language, consistent optical weight, balanced geometry, and crisp edges.",
    "VARIANT",
    direction,
    "SIZE AND LEGIBILITY",
    `Reference sizes: ${input.sizes.join(", ")}px. Smallest target: ${Math.min(...input.sizes)}px. Preserve immediate recognition and simplify details for the smallest size.`,
    "COMPOSITION AND OUTPUT",
    "Compose one centered icon only with balanced safe padding. Never create a grid, collection, contact sheet, mockup, phone screen, or presentation board.",
    "Do not include text, labels, letters, watermarks, existing brand marks, protected characters, shadows, or unrelated decoration unless explicitly requested above.",
    "Return one square PNG-ready image. A transparent background must contain a real alpha channel.",
  ].join("\n");
}

function compileAppIconPrompt(input: CompileIconPromptInput, direction: string, presetToken: string) {
  return [
    "TASK",
    "Create exactly one original production app icon for a home screen, launcher, and app store.",
    "SUBJECT",
    `App concept: ${input.name}`,
    `Meaning: ${input.description}`,
    "VISUAL SYSTEM",
    `Style preset: ${presetToken}.`,
    "Honor the selected preset's material, dimensionality, camera, lighting, edge treatment, palette logic, and rendering language.",
    "VARIANT",
    direction,
    "SIZE AND LEGIBILITY",
    `Reference sizes: ${input.sizes.join(", ")}px. Smallest target: ${Math.min(...input.sizes)}px. Preserve a memorable silhouette and simplify details for the smallest size.`,
    "COMPOSITION AND OUTPUT",
    "Compose one centered app icon only, filling the square canvas with balanced safe margins. Never create multiple icons, a grid, collection, contact sheet, device mockup, or presentation board.",
    "Do not include text, labels, letters, watermarks, existing brand marks, protected characters, or unrelated decoration.",
    "Return one square PNG-ready image with crisp edges.",
  ].join("\n");
}

export function compileIconPrompt(input: CompileIconPromptInput) {
  const direction = variantDirections[input.slot - 1];
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
