import type { PreviewSvgColors } from "./preview-svg-colors";

export type ManualPreviewColor = {
  src: string;
  solid: string;
  alpha: number;
  gradient?: { start: string; end: string; mode: "linear" | "radial" };
};

/** Recolor only the palette-bearing paints in the bundled style SVG. */
export function recolorPreviewSvg(svg: string, original: PreviewSvgColors, selected: ManualPreviewColor): string {
  let result = svg;
  if (original.gradient && selected.gradient) {
    result = result.replace(/<(linearGradient|radialGradient)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => {
      const stops = [...block.matchAll(/stop-color="(#[0-9a-f]{6})"/gi)];
      if (stops.length < 2 || stops[0][1].toLowerCase() !== original.gradient!.start.toLowerCase() || stops.at(-1)![1].toLowerCase() !== original.gradient!.end.toLowerCase()) return block;
      let index = 0;
      return block.replace(/stop-color="#[0-9a-f]{6}"/gi, () => {
        const position = index++ / (stops.length - 1);
        const from = selected.gradient!.start.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
        const to = selected.gradient!.end.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
        const color = from.map((channel, channelIndex) => Math.round(channel + (to[channelIndex] - channel) * position).toString(16).padStart(2, "0")).join("");
        return `stop-color="#${color}"`;
      });
    });
  }
  const originalSolid = original.solid.toLowerCase();
  const alpha = Math.round(Math.max(0, Math.min(100, selected.alpha)) * 255 / 100).toString(16).padStart(2, "0");
  result = result.replace(/((?:fill|stroke)="|--ink:)(#[0-9a-f]{6})([0-9a-f]{2})?/gi, (match, prefix: string, hex: string, suffix?: string) => {
    if (hex.toLowerCase() !== originalSolid) return match;
    return `${prefix}${selected.solid}${suffix ? alpha : ""}`;
  });
  return result;
}
