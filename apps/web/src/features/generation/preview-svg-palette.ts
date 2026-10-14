import type { PreviewSvgColors } from "./preview-svg-colors";
import { LIBRARY_GENERATION_STYLES, libraryStylePreview } from "./library-generation-styles";

/** The six library previews start from a neutral ink that manual colors can replace. */
export function previewPaletteFor(src: string, dark: boolean): PreviewSvgColors | null {
  const path = src.split("?")[0];
  if (!LIBRARY_GENERATION_STYLES.some(style => path === libraryStylePreview(style))) return null;
  return { solid: dark ? "#D6DCE5" : "#343A40" };
}
