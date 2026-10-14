import { z } from "zod";
import { SaxesParser } from "saxes";
import { validateGeneratedSvg } from "./validate-generated-svg";

const n = z.number().finite().min(-128).max(128);
const point = z.tuple([n, n]);
const command = z.union([
  z.tuple([z.literal("M"), n, n]), z.tuple([z.literal("L"), n, n]),
  z.tuple([z.literal("H"), n]), z.tuple([z.literal("V"), n]),
  z.tuple([z.literal("Q"), n, n, n, n]),
  z.tuple([z.literal("C"), n, n, n, n, n, n]), z.tuple([z.literal("Z")]),
]);
const repetition = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("radial"), center: point, count: z.number().int().min(2).max(32), mirror: z.boolean().optional() }).strict(),
  z.object({ kind: z.literal("linear"), step: point, count: z.number().int().min(2).max(32) }).strict(),
  z.object({ kind: z.literal("mirror"), axis: z.enum(["x", "y"]), at: n }).strict(),
]);
export const svgGeometryPlanSchema = z.object({
  version: z.literal("1"),
  paths: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/).max(60),
    commands: z.array(command).min(2).max(128),
    repeat: repetition.optional(),
    join: z.enum(["separate", "open", "closed"]).default("separate"),
  }).strict()).max(24),
}).strict().superRefine((plan, ctx) => {
  if (new Set(plan.paths.map(path => path.id)).size !== plan.paths.length) ctx.addIssue({ code: "custom", message: "Geometry path IDs must be unique" });
  let size = 0;
  for (const path of plan.paths) {
    const { commands, repeat, join } = path;
    if (commands[0][0] !== "M" || commands.slice(1).some(c => c[0] === "M")) ctx.addIssue({ code: "custom", message: `${path.id}: one initial absolute M required` });
    if (commands.slice(0, -1).some(c => c[0] === "Z")) ctx.addIssue({ code: "custom", message: `${path.id}: Z is only allowed at the end` });
    if (join !== "separate" && (repeat || join === "open") && commands.some(c => c[0] === "Z")) ctx.addIssue({ code: "custom", message: `${path.id}: joined units must be open; assembler closes the final contour` });
    size += commands.length * (repeat?.kind === "mirror" ? 2 : (repeat?.count ?? 1) * (repeat?.kind === "radial" && repeat.mirror ? 2 : 1));
  }
  if (size > 8192) ctx.addIssue({ code: "custom", message: "Geometry expansion exceeds 8192 commands" });
});
export type SvgGeometryPlan = z.infer<typeof svgGeometryPlanSchema>;
type Point = [number, number];
type Segment = { kind: "L" | "Q" | "C"; from: Point; to: Point; controls: Point[] };
type Contour = { start: Point; segments: Segment[]; closed: boolean };
type PathPlan = SvgGeometryPlan["paths"][number];

function normalize(commands: PathPlan["commands"]): Contour {
  const first = commands[0] as ["M", number, number];
  const start: Point = [first[1], first[2]];
  let from = start;
  const segments: Segment[] = [];
  for (const c of commands.slice(1)) {
    if (c[0] === "Z") continue;
    let to: Point;
    const controls: Point[] = [];
    if (c[0] === "H") to = [c[1], from[1]];
    else if (c[0] === "V") to = [from[0], c[1]];
    else if (c[0] === "Q") { controls.push([c[1], c[2]]); to = [c[3], c[4]]; }
    else if (c[0] === "C") { controls.push([c[1], c[2]], [c[3], c[4]]); to = [c[5], c[6]]; }
    else to = [c[1], c[2]];
    segments.push({ kind: c[0] === "Q" || c[0] === "C" ? c[0] : "L", from, to, controls });
    from = to;
  }
  return { start, segments, closed: commands.at(-1)?.[0] === "Z" };
}
const end = (c: Contour) => c.segments.at(-1)?.to ?? c.start;
// Model coordinates are commonly rounded to three decimals. Accept only that
// serialization error at a joined seam; larger gaps remain structural errors.
const same = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.0015;
function mapContour(c: Contour, map: (p: Point) => Point): Contour {
  return { start: map(c.start), closed: c.closed, segments: c.segments.map(s => ({ ...s, from: map(s.from), to: map(s.to), controls: s.controls.map(map) })) };
}
function reverse(c: Contour): Contour {
  return { start: end(c), closed: c.closed, segments: [...c.segments].reverse().map(s => ({ ...s, from: s.to, to: s.from, controls: [...s.controls].reverse() })) };
}
function instances(path: PathPlan): Contour[] {
  const unit = normalize(path.commands), repetition = path.repeat;
  if (!repetition) return [unit];
  if (repetition.kind === "linear") return Array.from({ length: repetition.count }, (_, i) => mapContour(unit, p => [p[0] + repetition.step[0] * i, p[1] + repetition.step[1] * i]));
  if (repetition.kind === "mirror") {
    const reflected = mapContour(unit, p => repetition.axis === "x" ? [2 * repetition.at - p[0], p[1]] : [p[0], 2 * repetition.at - p[1]]);
    return [unit, path.join === "separate" ? reflected : reverse(reflected)];
  }
  const [cx, cy] = repetition.center;
  const rotate = (c: Contour, i: number) => mapContour(c, ([x, y]) => {
    const angle = 2 * Math.PI * i / repetition.count;
    // Exact right-angle axes preserve the original pixel grid.
    const cos = Math.round(Math.cos(angle) * 1e12) / 1e12, sin = Math.round(Math.sin(angle) * 1e12) / 1e12;
    return [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos];
  });
  const result: Contour[] = [];
  for (let i = 0; i < repetition.count; i++) {
    result.push(rotate(unit, i));
    if (repetition.mirror) {
      const reflected = mapContour(unit, ([x, y]) => [x, 2 * cy - y]);
      const instance = rotate(reflected, i + 1);
      result.push(path.join === "separate" ? instance : reverse(instance));
    }
  }
  return result;
}
const number = (n: number) => String(Math.round(n * 1e6) / 1e6);
const xy = (p: Point) => p.map(number).join(" ");
function serialize(c: Contour) {
  let d = `M${xy(c.start)}`;
  for (const s of c.segments) {
    if (s.kind === "L") d += Math.abs(s.from[1] - s.to[1]) < 1e-9 ? `H${number(s.to[0])}` : Math.abs(s.from[0] - s.to[0]) < 1e-9 ? `V${number(s.to[1])}` : `L${xy(s.to)}`;
    else d += `${s.kind}${[...s.controls, s.to].map(xy).join(" ")}`;
  }
  return d + (c.closed ? "Z" : "");
}

/** Pure bounded arithmetic: no evaluation, semantic lookup, styling or aesthetic repair. */
export function compileGeometryPaths(input: unknown): Map<string, string> {
  const plan = svgGeometryPlanSchema.parse(input);
  return new Map(plan.paths.map(path => {
    const copies = instances(path);
    if (path.join === "separate") return [path.id, copies.map(serialize).join(" ")];
    // A single explicit Z already closes the source contour. Treat a redundant
    // closed label as the same intent; no repeated sector or gap is repaired.
    if (!path.repeat && path.join === "closed" && copies[0].closed) return [path.id, serialize(copies[0])];
    for (let i = 1; i < copies.length; i++) if (!same(end(copies[i - 1]), copies[i].start)) throw new Error(`Geometry ${path.id}: joined endpoints must coincide; use separate for disconnected units`);
    if (path.join === "closed" && !same(end(copies.at(-1)!), copies[0].start)) throw new Error(`Geometry ${path.id}: last endpoint must meet first; no automatic bridging edge`);
    const contour: Contour = { start: copies[0].start, segments: copies.flatMap(c => c.segments), closed: path.join === "closed" };
    return [path.id, serialize(contour)];
  }));
}
const xml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

/** Explicit data-geometry bindings only; unbound/native SVGs remain unchanged. */
export function assembleSvgGeometry(svg: string, plan?: SvgGeometryPlan): string {
  if (!plan && !/\bdata-geometry\s*=/.test(svg)) return svg;
  validateGeneratedSvg(svg);
  const paths = plan ? compileGeometryPaths(plan) : new Map<string, string>();
  const parser = new SaxesParser();
  let result = "";
  parser.on("opentag", tag => {
    const attributes: Record<string, string> = Object.fromEntries(Object.entries(tag.attributes).map(([k, v]) => [k, String(v)]));
    const binding = attributes["data-geometry"];
    if (binding !== undefined) {
      if (tag.name !== "path") throw new Error("data-geometry can only bind a path");
      const ids = binding.trim().split(/\s+/);
      if (!binding.trim() || ids.some(id => !paths.has(id))) throw new Error("SVG contains an unresolved geometry binding");
      attributes.d = ids.map(id => paths.get(id)).join(" ");
      delete attributes["data-geometry"];
    }
    result += `<${tag.name}${Object.entries(attributes).map(([k, v]) => ` ${k}="${xml(v)}"`).join("")}>`;
    if (result.length > 100_000) throw new Error("Expanded SVG exceeds 100 KB");
  });
  parser.on("closetag", tag => { result += `</${tag.name}>`; });
  parser.on("text", text => { result += xml(text); });
  parser.on("error", error => { throw error; });
  parser.write(svg).close();
  return validateGeneratedSvg(result);
}

export const GEOMETRY_ASSEMBLY_PROMPT = `EXECUTABLE GEOMETRY OUTPUT CONTRACT v1:
Return top-level members in this order: designCard, geometry, then svg (or outlineSvg and solidSvg). geometry is actual source data, not prose in the designCard. Put each custom path's numeric commands in geometry.paths and reference its ID from the SVG using data-geometry; do not manually spell out that same path's d in the SVG. Native circles/rects/ellipses/lines may remain in the SVG; paths may be empty only when no custom paths are needed. Naturally asymmetric paths use one unit with no repeat. Repeated/mirrored rigid contours MUST describe one unit and its repeat rather than hand-list all copies. This output format replaces an SVG-only response; it does not ask for a second design or model call.
geometry:{version:"1",paths:[{id:"part-outline",commands:[["M",x,y],["H",x],["V",y],["L",x,y],["Q",cx,cy,x,y],["C",c1x,c1y,c2x,c2y,x,y]],repeat:{kind:"radial",center:[cx,cy],count:n},join:"closed"}]}. All coordinates must be actual finite numbers, no expressions. Write only the commands needed, not this list verbatim. One initial M per unit, Z only at the end of a separate closed unit. IDs are unique kebab-case. No A/relative commands in geometry plans; use a native circle/ellipse for a complete round primitive or cubic/quadratic curves for a freeform contour.
In the SVG, use <path data-geometry="part-outline" data-part-id="meaningful-part" fill="none" stroke="..." .../>. Do not write d or manually duplicate geometry at this binding. The local assembler expands numeric units to ordinary explicit SVG paths; it does not design the subject or change paint. Multiple IDs separated by spaces combine contours in one path (e.g. an evenodd solid aperture). All material/lighting layers can reference the SAME ID; State Pair can share stable geometry IDs, with independently planned fill/negative-space treatment. Do not use SVG use/href.
Repetition choices: radial rotates exact copies by 360/count about center; linear uses {kind:"linear",step:[dx,dy],count:n}; mirror uses {kind:"mirror",axis:"x",at:cx} for reflection across x=cx (axis y across y=cy). Omit repeat for one reusable contour. join=separate keeps independent subpaths. join=open joins matching unit endpoints; join=closed additionally requires the final endpoint to coincide with the first and then closes ONCE. Joined units must be open, with no Z and no line back to the center. No gap is bridged or adjusted by the assembler: design the unit's endpoints to meet mathematically. For filled bodies combine full closed exposed contours and true apertures, not separate wedge fillings.
PIXEL SYMMETRY: for a genuinely fourfold-and-mirror symmetric contour, use radial count=4, mirror=true. Design ONLY the clockwise octant from the positive X axis (y=cy,x>cx) to the southeast diagonal (x-cx=y-cy>0). The assembler reflects that octant into the next one, reverses its traversal, and rotates quadrants by exact 90 degrees, yielding one continuous eight-octant outline. This preserves H/V grid edges without 45-degree raster rotation. If only fourfold symmetry is real, omit mirror and supply a full quadrant instead. Plan a whole-cell valley, a purposeful tip width and actual body/opening proportions in that small unit; do not leave their construction to accidental zigzags. Preserve natural asymmetry with a single non-repeated path where symmetry is not real.
This plan is numeric source geometry, not metadata-only promises or a post-generation shape replacement. Do not invent repeated parts merely to use it. Preserve the requested subject and selected style; new geometry references never authorize extra color, decoration or a background.`;
