/** The generation menu uses the same canonical six styles as the asset library. */
export const LIBRARY_GENERATION_STYLES = ["linear", "outline", "bold", "broken", "bulk", "twotone"] as const;
export type LibraryGenerationStyle = (typeof LIBRARY_GENERATION_STYLES)[number];

export const LIBRARY_GENERATION_LABELS: Record<LibraryGenerationStyle, { en: string; zh: string }> = {
  linear: { en: "Linear", zh: "线性" },
  outline: { en: "Outline", zh: "轮廓" },
  bold: { en: "Bold", zh: "实心" },
  broken: { en: "Broken", zh: "断线" },
  bulk: { en: "Bulk", zh: "深浅填充" },
  twotone: { en: "Twotone", zh: "双色层次" },
};

export function isLibraryGenerationStyle(value: string): value is LibraryGenerationStyle {
  return (LIBRARY_GENERATION_STYLES as readonly string[]).includes(value);
}

export function libraryStylePreview(style: LibraryGenerationStyle) {
  return `/library/samples/emoji-sample-1/${style}.svg`;
}
