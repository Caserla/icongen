import { SaxesParser } from "saxes";

const elements = new Set(["svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "linearGradient", "radialGradient", "stop", "mask", "clipPath", "filter", "feGaussianBlur", "feOffset", "feMerge", "feMergeNode", "feBlend", "feComposite", "feFlood", "feColorMatrix", "title", "desc"]);
export function validateGeneratedSvg(raw: string): string {
  const svg = raw.trim().replace(/^```(?:svg|xml)?\s*/i, "").replace(/\s*```$/, "");
  if (svg.length > 100_000 || !svg.startsWith("<svg")) throw new Error("Expected a standalone SVG under 100 KB");
  let shapes = 0, nodes = 0;
  const ids = new Set<string>(), refs: string[] = [];
  const parser = new SaxesParser();
  parser.on("doctype", () => { throw new Error("DOCTYPE is forbidden"); });
  parser.on("processinginstruction", () => { throw new Error("Processing instructions are forbidden"); });
  parser.on("opentag", tag => {
    if (!elements.has(tag.name) || ++nodes > 1000) throw new Error("Unsupported SVG element");
    if (nodes === 1 && (tag.name !== "svg" || tag.attributes.viewBox !== "0 0 24 24")) throw new Error("Use viewBox 0 0 24 24");
    if (["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"].includes(tag.name)) shapes++;
    for (const [name, value] of Object.entries(tag.attributes)) {
      const text = String(value);
      if (/^on/i.test(name) || /href|style/i.test(name) || /javascript:|data:|https?:|@import|expression\s*\(/i.test(text) && name !== "xmlns") throw new Error("Unsafe SVG attribute");
      if (name === "xmlns" && text !== "http://www.w3.org/2000/svg") throw new Error("Invalid SVG namespace");
      if (name === "id") { if (ids.has(text)) throw new Error("Duplicate SVG id"); ids.add(text); }
      if (/url\(/i.test(text)) {
        if (!/^url\(#[\w-]+\)$/.test(text)) throw new Error("Only local paint references are allowed");
        refs.push(text.slice(5, -1));
      }
    }
  });
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  if (!shapes || refs.some(ref => !ids.has(ref))) throw new Error("Empty SVG or broken reference");
  return svg;
}
