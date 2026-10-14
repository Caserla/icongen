import { SaxesParser } from "saxes";
import { validateGeneratedSvg } from "./validate-generated-svg";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Mask luminance and filter paints are geometry, not foreground colors. */
export function applyLockedSolidColor(raw: string, color: string, alpha = 1) {
  const svg = validateGeneratedSvg(raw);
  const parser = new SaxesParser();
  const protectedStack: boolean[] = [];
  let output = "";
  parser.on("opentag", tag => {
    const protectedPaint = Boolean(protectedStack.at(-1)) || ["mask", "clipPath", "filter"].includes(tag.name);
    protectedStack.push(protectedPaint);
    const attrs = Object.entries(tag.attributes).map(([name, value]) => {
      const paint = String(value);
      const replace = !protectedPaint && ["fill", "stroke", "stop-color", "color"].includes(name)
        && !/^(none|transparent|url\()/i.test(paint.trim());
      return ` ${name}="${escapeXml(replace ? color : paint)}"`;
    }).join("");
    output += `<${tag.name}${attrs}${tag.name === "svg" && !("fill" in tag.attributes) ? ` fill="${escapeXml(color)}"` : ""}>`;
    if (tag.name === "svg" && alpha !== 1) output += `<g opacity="${Math.max(0, Math.min(1, alpha))}">`;
  });
  parser.on("closetag", tag => { if (tag.name === "svg" && alpha !== 1) output += "</g>"; output += `</${tag.name}>`; protectedStack.pop(); });
  parser.on("text", text => { output += escapeXml(text); });
  parser.on("cdata", text => { output += escapeXml(text); });
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  return output;
}
