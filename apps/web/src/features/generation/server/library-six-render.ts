import sharp from "sharp";
import { SaxesParser } from "saxes";
import { validateGeneratedSvg } from "./validate-generated-svg";
import { themeDisplaySvg } from "../theme-display-svg";
import type { LibrarySubjectPlan } from "./library-six-plan";

const shapes = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const geometryAttributes = new Set(["d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "stroke-width"]);
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function isolatePart(svg: string, partId: string) {
  const parser = new SaxesParser();
  const stack: string[][] = [];
  let output = "", merged = false;
  parser.on("opentag", tag => {
    const own = `${tag.attributes["data-part-id"] ?? ""} ${tag.attributes["data-part-ids"] ?? ""}`.trim().split(/\s+/).filter(Boolean);
    const ids = own.length ? own : stack.at(-1) ?? [];
    stack.push(ids);
    const visible = ids.includes(partId);
    if (visible && shapes.has(tag.name) && ids.length > 1) merged = true;
    const attrs = { ...tag.attributes, ...(shapes.has(tag.name) && !visible ? { opacity: "0" } : {}) };
    output += `<${tag.name}${Object.entries(attrs).map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`).join("")}>`;
  });
  parser.on("closetag", tag => { output += `</${tag.name}>`; stack.pop(); });
  parser.on("text", text => { output += escapeXml(text); });
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  return { svg: output, merged };
}

async function inkMetrics(svg: string) {
  const padded = svg.replace(/currentColor/g, "#343A40").replace(/viewBox=(["'])0 0 24 24\1/, 'viewBox="-2 -2 28 28"');
  const pixels = await sharp(Buffer.from(padded)).resize(280, 280).ensureAlpha().raw().toBuffer();
  let left = 280, top = 280, right = -1, bottom = -1, ink = 0;
  for (let y = 0; y < 280; y++) for (let x = 0; x < 280; x++) {
    const alpha = pixels[(y * 280 + x) * 4 + 3]; ink += alpha / 255;
    if (alpha < 24) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { bounds: right < 0 ? null : [left / 10 - 2, top / 10 - 2, (right + 1) / 10 - 2, (bottom + 1) / 10 - 2], inkArea: ink / 100 };
}

/** Technical facts only. Never convert these measurements into a beauty score. */
export async function inspectLibrarySvg(svg: string, style: string, plan: LibrarySubjectPlan) {
  validateGeneratedSvg(svg);
  const parts = new Set<string>(), holes = new Set<string>();
  const stack: Array<{ parts: string[]; stroke: string; width: number; hidden: boolean }> = [];
  const parser = new SaxesParser();
  parser.on("opentag", tag => {
    const parent = stack.at(-1);
    const ownParts = `${tag.attributes["data-part-id"] ?? ""} ${tag.attributes["data-part-ids"] ?? ""}`.split(/\s+/).filter(Boolean);
    const state = { parts: ownParts.length ? ownParts : parent?.parts ?? [],
      stroke: String(tag.attributes.stroke ?? parent?.stroke ?? "none"), width: Number(tag.attributes["stroke-width"] ?? parent?.width ?? 1),
      hidden: !!parent?.hidden || tag.name === "defs" };
    stack.push(state);
    if (["filter", "mask", "text", "image"].includes(tag.name)) throw new Error(`Unsupported library construction: ${tag.name}`);
    if (tag.attributes.transform) throw new Error("Write final coordinates; library geometry must not be distorted by transforms");
    if (tag.attributes["data-hole-ids"]) String(tag.attributes["data-hole-ids"]).split(/\s+/).forEach(id => holes.add(id));
    for (const [key, value] of Object.entries(tag.attributes)) {
      if (geometryAttributes.has(key) && /(?:NaN|Infinity)/i.test(String(value))) throw new Error(`Non-finite ${key}`);
    }
    if (!state.hidden && shapes.has(tag.name)) {
      const semanticIds = state.parts;
      if (!semanticIds.length || semanticIds.some(id => !plan.parts.some(p => p.id === id))) throw new Error(`Missing or unknown data-part-id: ${semanticIds.join(" ")}`);
      semanticIds.forEach(id => parts.add(id));
      if (!/^(none|transparent)$/i.test(state.stroke) && Math.abs(state.width - 1.5) > 0.001) throw new Error("Library strokes must be 1.5 units");
      if (style === "outline" && !/^(none|transparent)$/i.test(state.stroke)) throw new Error("Outline requires fixed expanded fills, not actual strokes");
    }
  });
  parser.on("closetag", () => stack.pop());
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  for (const part of plan.parts) {
    if (!parts.has(part.id) && !(part.role === "aperture" && holes.has(part.id))) throw new Error(`Planned semantic part is missing: ${part.id}`);
  }
  // Include a margin around the viewBox: detect real off-canvas ink, not only clipped output.
  const { bounds, inkArea } = await inkMetrics(svg);
  if (!bounds) throw new Error("Rendered SVG is empty");
  if (bounds[0] < 0 || bounds[1] < 0 || bounds[2] > 24 || bounds[3] > 24) throw new Error(`Off-canvas ink: ${bounds.join(",")}`);
  const partBounds = await Promise.all(plan.parts.filter(part => parts.has(part.id)).map(async part => {
    const isolated = isolatePart(svg, part.id);
    const measured = await inkMetrics(isolated.svg);
    return { partId: part.id, plannedBounds: part.bounds, actualBounds: measured.bounds, mergedContour: isolated.merged };
  }));
  // This checks the subject's own pre-drawing budget, not a global aesthetic gap.
  // Compound contours cannot be measured separately and are deliberately excluded.
  const planWarnings = partBounds.flatMap(part => {
    if (part.mergedContour || !part.actualBounds) return [];
    const a = part.actualBounds, p = part.plannedBounds;
    const overflow = Math.max(p[0] - a[0], p[1] - a[1], a[2] - p[2], a[3] - p[3]);
    return overflow > 0.45 ? [{ partId: part.partId, defect: `Actual ink bounds ${a.join(",")} exceed the pre-drawing ink allocation ${p.join(",")} by ${overflow.toFixed(2)} units.`, repair: "Account for half the stroke width in path placement; fit this part's ink inside its planned allocation without shrinking the entire subject or changing the stroke width." }] : [];
  });
  return { inkBounds: bounds, inkArea, partIds: [...parts], holeIds: [...holes], partBounds, planWarnings,
    measurementNote: "0.1-unit raster precision; mergedContour measures the joint contour, not isolated constituent parts. Hole-ID presence is NOT proof of hole geometry. Spacing and optical corrections still need rendered review." };
}

export async function renderLibraryReview(variants: Record<string, string>) {
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } }> = [];
  for (const [style, svg] of Object.entries(variants)) {
    for (const theme of ["light", "dark"] as const) {
      const background = theme === "dark" ? "#171A20" : "#FFFFFF";
      // Match the frontend's neutral theme adaptation; preserve explicitly chosen custom colors.
      const themed = themeDisplaySvg(svg, theme);
      const layers = await Promise.all([24, 48, 192].map(async (size, i) => ({
        input: await sharp(Buffer.from(themed)).resize(size, size).png().toBuffer(),
        left: [12, 60, 132][i], top: Math.floor((216 - size) / 2),
      })));
      const png = await sharp({ create: { width: 336, height: 216, channels: 4, background } }).composite(layers).png().toBuffer();
      content.push({ type: "text", text: `CANDIDATE ${style}; ${theme}; left-to-right actual 24px, 48px, enlarged 192px; no cropping or stretching.` },
        { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}`, detail: "high" } });
    }
  }
  return content;
}
