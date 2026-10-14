import { monochromeSvgColor, recolorMonochromeSvg } from "./monochrome-svg";

const LIGHT_INK = "#343A40";
const DARK_INK = "#D6DCE5";

/** Adapt only the neutral library ink for the canvas; persisted SVG/downloads stay unchanged. */
export function themeDisplaySvg(svg: string, theme: "light" | "dark") {
  const target = theme === "dark" ? DARK_INK : LIGHT_INK;
  const paint = monochromeSvgColor(svg);
  if (paint === LIGHT_INK.toLowerCase() || paint === DARK_INK.toLowerCase()) {
    return recolorMonochromeSvg(svg, paint, target);
  }
  if (!paint && /\bcurrentColor\b/i.test(svg)) {
    return svg.replace(/\bcurrentColor\b/gi, target);
  }
  return svg;
}
