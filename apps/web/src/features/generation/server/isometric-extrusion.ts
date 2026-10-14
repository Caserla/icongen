import { SaxesParser } from "saxes";
import { compileGeometryPaths, type SvgGeometryPlan } from "./svg-geometry-plan";
import { validateGeneratedSvg } from "./validate-generated-svg";

const escapeXml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

/** Production construction: one authored front contour supplies every depth copy. */
export function extrudeIsometricSvg(svg: string, geometry: SvgGeometryPlan | undefined, shade: string, idPrefix: string, depth: [number, number] = [1.2, 1.15]) {
  if (!geometry) throw new Error("Isometric candidate requires executable front geometry");
  if (!/^#[0-9a-f]{6}$/i.test(shade)) throw new Error("Isometric candidate requires a frozen shade paint");
  if (depth.some(value => !Number.isFinite(value) || value < 0.2 || value > 2)) throw new Error("Invalid candidate depth");
  const paths = compileGeometryPaths(geometry);
  const parser = new SaxesParser();
  let output = "";
  let extruded = 0;
  parser.on("opentag", tag => {
    const attributes: Record<string, string> = Object.fromEntries(Object.entries(tag.attributes).map(([name, value]) => [name, String(value)]));
    const transform = attributes.transform?.trim();
    if (tag.name === "g" && transform?.startsWith("matrix(")) {
      const values = transform.match(/^matrix\(\s*([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)[,\s]+([-+\d.eE]+)\s*\)$/)?.slice(1).map(Number);
      if (!values || values.some(value => !Number.isFinite(value))) throw new Error("Isometric front transform must be a numeric matrix");
      const [a, b, c, d] = values;
      const firstLength = Math.hypot(a, b);
      const secondLength = Math.hypot(c, d);
      const dot = a * c + b * d;
      if (firstLength < 0.5 || secondLength < 0.5 || Math.abs(firstLength - secondLength) > 0.025 || Math.abs(dot) > 0.025) {
        throw new Error("Isometric front face is compressed or sheared; use rotation plus uniform scale and express depth in the side walls");
      }
    }
    const source = attributes["data-extrude-source"];
    const hole = attributes["data-extrude-hole"];
    delete attributes["data-extrude-source"];
    delete attributes["data-extrude-hole"];
    if (source !== undefined) {
      if (tag.name !== "path" || !source.trim()) throw new Error("Isometric extrusion belongs on a front path");
      const sourceIds = source.trim().split(/\s+/);
      if (sourceIds.some(id => !paths.has(id)) || (hole && !paths.has(hole))) throw new Error("Isometric extrusion references missing geometry");
      const frontD = sourceIds.map(id => paths.get(id)).join(" ");
      if (attributes.d !== frontD) throw new Error("Extruded depth must use the same exact geometry as its front face");
      const depthId = `${idPrefix}-depth-mask-${extruded++}`;
      if (hole) output += `<defs><mask id="${depthId}" maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32"><rect x="-4" y="-4" width="32" height="32" fill="white"/><path d="${escapeXml(paths.get(hole)!)}" fill="black"/></mask></defs>`;
      output += `<g${hole ? ` mask="url(#${depthId})"` : ""}>`;
      // Back-to-front quarter-unit steps make a continuous wall without a
      // second guessed silhouette or the stair-stepped edge of one offset copy.
      for (let step = 8; step >= 1; step--) {
        const fraction = step / 8;
        output += `<path d="${escapeXml(frontD)}" transform="translate(${(depth[0] * fraction).toFixed(3)} ${(depth[1] * fraction).toFixed(3)})" fill="${shade}" fill-rule="${escapeXml(attributes["fill-rule"] ?? "evenodd")}"/>`;
      }
      output += "</g>";
    }
    output += `<${tag.name}${Object.entries(attributes).map(([name, value]) => ` ${name}="${escapeXml(value)}"`).join("")}>`;
  });
  parser.on("closetag", tag => { output += `</${tag.name}>`; });
  parser.on("text", value => { output += escapeXml(value); });
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  if (!extruded) throw new Error("Isometric candidate contains no shared front/depth contour");
  return validateGeneratedSvg(output);
}
