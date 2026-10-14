import { SaxesParser } from "saxes";
import { validateGeneratedSvg } from "./validate-generated-svg";

type Gradient = { mode?: unknown; color?: unknown; endColor?: unknown; alpha?: number; endAlpha?: number; angle?: number; startOffset?: number; endOffset?: number };
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function lockedGradient(colors: unknown) {
  if (!colors || typeof colors !== "object") return null;
  const value = colors as { locked?: unknown; default?: unknown };
  if (value.locked !== true || !value.default || typeof value.default !== "object") return null;
  const selected = value.default as Gradient;
  if ((selected.mode !== "linear" && selected.mode !== "radial")
    || typeof selected.color !== "string" || typeof selected.endColor !== "string"
    || !/^#[0-9a-f]{6}$/i.test(selected.color) || !/^#[0-9a-f]{6}$/i.test(selected.endColor)) return null;
  const clamp = (value: number | undefined, fallback: number, max: number) => Number.isFinite(value) ? Math.max(0, Math.min(max, value!)) : fallback;
  const startOffset = clamp(selected.startOffset, 0, 100);
  return { mode: selected.mode, start: selected.color.toUpperCase(), end: selected.endColor.toUpperCase(),
    alpha: clamp(selected.alpha, 1, 1), endAlpha: clamp(selected.endAlpha, 1, 1),
    angle: Number.isFinite(selected.angle) ? selected.angle! % 360 : 135,
    startOffset: startOffset / 100, endOffset: Math.max(startOffset, clamp(selected.endOffset, 100, 100)) / 100 } as const;
}

export function applyLockedGradient(svg: string, colors: unknown, idPrefix: string) {
  const gradient = lockedGradient(colors);
  if (!gradient) return svg;
  const id = `${idPrefix}-locked-gradient`;
  const stops = `<stop offset="${gradient.startOffset}" stop-color="${gradient.start}" stop-opacity="${gradient.alpha}"/><stop offset="${gradient.endOffset}" stop-color="${gradient.end}" stop-opacity="${gradient.endAlpha}"/>`;
  const definition = gradient.mode === "radial"
    ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="7.2" cy="6" r="19.2">${stops}</radialGradient>`
    : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="24" y2="12" gradientTransform="rotate(${gradient.angle} 12 12)">${stops}</linearGradient>`;
  const parser = new SaxesParser();
  const protectedStack: boolean[] = [];
  let output = "";
  parser.on("opentag", tag => {
    const protectedPaint = Boolean(protectedStack.at(-1)) || ["mask", "clipPath", "filter", "linearGradient", "radialGradient"].includes(tag.name);
    protectedStack.push(protectedPaint);
    const attributes = Object.entries(tag.attributes).map(([name, raw]) => {
      const value = String(raw);
      const preserve = /^(none|transparent|white|#fff|#ffffff)$/i.test(value.trim());
      const paint = !protectedPaint && ["fill", "stroke"].includes(name) && !preserve ? `url(#${id})` : value;
      return ` ${name}="${escapeXml(paint)}"`;
    }).join("");
    output += `<${tag.name}${attributes}${tag.name === "svg" && !("fill" in tag.attributes) ? ` fill="url(#${id})"` : ""}>`;
    if (tag.name === "svg") output += `<defs>${definition}</defs>`;
  });
  parser.on("closetag", tag => { output += `</${tag.name}>`; protectedStack.pop(); });
  parser.on("text", value => { output += escapeXml(value); });
  parser.on("error", error => { throw error; });
  parser.write(validateGeneratedSvg(svg)).close();
  return output;
}

export function assertStyleConformance(svg: string, styleId: string) {
  const strokes: Array<{ width: number; core: boolean; signature: string; unfiltered: boolean; fill: string }> = [];
  const stack: Array<{ stroke?: string; width: number; hidden: boolean; core: boolean; transforms: string; filtered: boolean; fill: string }> = [];
  const parser = new SaxesParser();
  parser.on("opentag", tag => {
    const parent = stack.at(-1);
    const state = {
      stroke: tag.attributes.stroke === undefined ? parent?.stroke : String(tag.attributes.stroke),
      width: tag.attributes["stroke-width"] === undefined ? parent?.width ?? 1 : Number(tag.attributes["stroke-width"]),
      hidden: Boolean(parent?.hidden) || ["defs", "mask", "clipPath", "filter"].includes(tag.name),
      core: tag.attributes["data-emission-layer"] === undefined ? parent?.core ?? false : tag.attributes["data-emission-layer"] === "core",
      transforms: `${parent?.transforms ?? ""}${tag.attributes.transform ? `/${tag.attributes.transform}` : ""}`,
      filtered: Boolean(parent?.filtered) || Boolean(tag.attributes.filter && tag.attributes.filter !== "none"),
      fill: String(tag.attributes.fill ?? parent?.fill ?? "black"),
    };
    stack.push(state);
    if (!state.hidden && /^(path|rect|circle|ellipse|line|polyline|polygon)$/.test(tag.name)
      && state.stroke && !/^(none|transparent)$/i.test(state.stroke) && state.width > 0) {
      const geometry = ["d", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points"]
        .map(name => `${name}=${tag.attributes[name] ?? ""}`).join(";");
      strokes.push({ width: state.width, core: state.core, signature: `${tag.name}|${state.transforms}|${geometry}`, unfiltered: !state.filtered, fill: state.fill });
    }
  });
  parser.on("closetag", () => { stack.pop(); });
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  // A planned neon core repeats an existing tube, not a second structural line system.
  const strokeWidths = strokes.filter(stroke => {
    if (styleId !== "neon-tube" || !stroke.core) return true;
    const matchedEnvelope = stroke.width === 0.75 && stroke.unfiltered && stroke.fill === "none"
      && strokes.some(body => !body.core && body.width === 1.5 && body.unfiltered && body.fill === "none" && body.signature === stroke.signature);
    if (!matchedEnvelope) throw new Error("Neon emission core must share an unfiltered 1.5-unit tube's geometry and transform at 0.75 units");
    return false;
  }).map(stroke => stroke.width);
  const distinctStrokeWidths = [...new Set(strokeWidths.map(width => Math.round(width * 100) / 100))];
  const uniformStroke = ["linear", "outline", "broken", "bulk", "twotone", "thin", "light", "regular", "bold-outline", "broken-outline", "soft-rounded", "fully-rounded", "sharp", "angular", "grid-based", "state-pair", "pixel-outline", "neon-tube", "dual-neon", "gradient-outline"].includes(styleId);
  if (uniformStroke && distinctStrokeWidths.length > 1) throw new Error(`Inconsistent stroke widths: ${distinctStrokeWidths.join(", ")}`);
  if (styleId === "radial" && !/<radialGradient\b/i.test(svg)) throw new Error("Radial style requires a radialGradient paint");
  if (["gradient-outline", "gradient-fill", "multi-stop", "dual-neon"].includes(styleId) && !/<linearGradient\b/i.test(svg)) {
    throw new Error("Selected style requires a linearGradient paint");
  }
}
