import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import initialize from "pathkit-wasm";
import { SaxesParser } from "saxes";
import sharp from "sharp";
import { validateGeneratedSvg } from "./validate-generated-svg";

// Both bundlers rewrite require.resolve/createRequire tokens. Read the traced
// filesystem asset directly, supporting workspace and standalone layouts.
async function readPathKitAsset() {
  const candidates = [path.resolve(process.cwd(), "node_modules/pathkit-wasm/bin/pathkit.wasm"), path.resolve(process.cwd(), "../../node_modules/pathkit-wasm/bin/pathkit.wasm")];
  for (const candidate of candidates) {
    try { return await readFile(candidate); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  throw new Error("PathKit WASM asset missing from the deployment.");
}
let kernel: ReturnType<typeof initialize> | undefined;
function pathKit() {
  // Share the kernel, never mutable paths. Retry a failed initialization on the next request.
  return kernel ??= readPathKitAsset()
    .then(wasmBinary => initialize({ wasmBinary })).catch(error => { kernel = undefined; throw error; });
}
export async function ensureLibraryOutlineKernel() {
  await pathKit();
}
const xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const attrs = (a: Record<string, string>) => Object.entries(a).map(([k, v]) => ` ${k}="${xml(v)}"`).join("");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const shapes = new Set(["path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
const inheritedKeys = ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "fill-opacity", "stroke-opacity"];
const geometryKeys = new Set(["d", "points", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", ...inheritedKeys]);

function pathData(name: string, a: Record<string, string>) {
  const n = (key: string, fallback = 0) => {
    if (a[key] === undefined) return fallback;
    const value = Number(a[key]);
    if (!Number.isFinite(value)) throw new Error(`Outline source needs numeric ${key}`);
    return value;
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
    if (rx <= 0 || ry <= 0) throw new Error("Outline source has an empty ellipse");
    return `M${cx-rx} ${cy}A${rx} ${ry} 0 1 0 ${cx+rx} ${cy}A${rx} ${ry} 0 1 0 ${cx-rx} ${cy}Z`;
  };
  if (name === "path") return a.d;
  if (name === "circle") return ellipse(n("cx"), n("cy"), n("r"), n("r"));
  if (name === "ellipse") return ellipse(n("cx"), n("cy"), n("rx"), n("ry"));
  if (name === "line") return `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`;
  if (name === "polyline" || name === "polygon") return `M${a.points ?? ""}${name === "polygon" ? "Z" : ""}`;
  const x = n("x"), y = n("y"), w = n("width"), h = n("height");
  if (w <= 0 || h <= 0) throw new Error("Outline source has an empty rectangle");
  const rx = Math.min(w / 2, n("rx", n("ry"))), ry = Math.min(h / 2, n("ry", n("rx")));
  if (rx < 0 || ry < 0) throw new Error("Outline source has negative corner radius");
  if (!rx || !ry) return `M${x} ${y}H${x+w}V${y+h}H${x}Z`;
  return `M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`;
}

/** Compile centerline geometry, not Bold or the subject's anatomy. Never redesign an existing asset. */
export async function compileLibraryOutline(source: string) {
  validateGeneratedSvg(source);
  const k = await pathKit();
  const stack: Array<Record<string, string>> = [];
  const parser = new SaxesParser();
  let output = "", expandedPaths = 0;
  parser.on("opentag", tag => {
    const a = Object.fromEntries(Object.entries(tag.attributes).map(([key, value]) => [key, String(value)]));
    if (!shapes.has(tag.name) && !["svg", "g", "title", "desc"].includes(tag.name)) throw new Error(`Unsupported Outline source element: ${tag.name}`);
    if (Object.keys(a).some(key => ["style", "transform", "stroke-dasharray", "stroke-dashoffset", "vector-effect", "pathLength", "paint-order", "clip-path", "mask", "filter"].includes(key))) throw new Error("Outline source must use plain undashed geometry without transforms or effects");
    const state: Record<string, string> = { fill: "black", stroke: "none", "stroke-width": "1", ...stack.at(-1), ...Object.fromEntries(inheritedKeys.filter(key => a[key] !== undefined).map(key => [key, a[key]])) };
    stack.push(state);
    if (!shapes.has(tag.name)) {
      output += `<${tag.name}${attrs(a)}>`;
      return;
    }
    const d = pathData(tag.name, a);
    if (!d) throw new Error("Outline source has no path geometry");
    // Keep opacity on a wrapper: fill and stroke composite together before group opacity.
    const wrapper = Object.fromEntries(Object.entries(a).filter(([key]) => !geometryKeys.has(key)));
    output += `<g${attrs(wrapper)}>`;
    if (state.fill !== "none" && state.fill !== "transparent" && tag.name !== "line") {
      output += `<path${attrs({ d, fill: state.fill, stroke: "none", "fill-rule": state["fill-rule"] ?? "nonzero", "fill-opacity": state["fill-opacity"] ?? "1" })}/>`;
    }
    if (state.stroke !== "none" && state.stroke !== "transparent") {
      if (Math.abs(Number(state["stroke-width"]) - 1.5) > 0.001 || state["stroke-linecap"] !== "round" || state["stroke-linejoin"] !== "round") throw new Error("Outline source requires 1.5-unit round strokes, caps and joins");
      const p = k.FromSVGString(d);
      if (!p) throw new Error("Outline source has invalid path data");
      try {
        // Skia's approximation tolerance is in path units. Work at 64× precision so
        // a 24-unit icon's rounded corners are not visibly faceted by expansion.
        p.transform(64, 0, 0, 0, 64, 0, 0, 0, 1);
        if (!p.stroke({ width: 96, cap: k.StrokeCap.ROUND, join: k.StrokeJoin.ROUND })) throw new Error("Outline stroke expansion failed");
        p.transform(1 / 64, 0, 0, 0, 1 / 64, 0, 0, 0, 1);
        output += `<path${attrs({ d: p.toSVGString(), fill: state.stroke, stroke: "none", "fill-opacity": state["stroke-opacity"] ?? "1", "fill-rule": p.getFillType() === k.FillType.EVENODD ? "evenodd" : "nonzero" })}/>`;
        expandedPaths++;
      } finally { p.delete(); }
    }
  });
  parser.on("closetag", tag => { output += `</${shapes.has(tag.name) ? "g" : tag.name}>`; stack.pop(); });
  parser.on("text", text => { output += xml(text); });
  parser.on("error", error => { throw error; });
  parser.write(source).close();
  if (!expandedPaths) throw new Error("Outline requires a clean centerline source, not hand-expanded fills");
  const svg = validateGeneratedSvg(output);
  const samples = await Promise.all([24, 48, 192].map(async size => {
    const render = async (s: string) => sharp(Buffer.from(s.replace(/currentColor/g, "#343A40"))).resize(size, size).ensureAlpha().raw().toBuffer();
    const [before, after] = await Promise.all([render(source), render(svg)]);
    let error = 0, ink = 0;
    for (let i = 3; i < before.length; i += 4) { error += Math.abs(before[i] - after[i]); ink += before[i]; }
    return { size, relativeAlphaError: error / Math.max(ink, 1) };
  }));
  if (samples.some(s => s.relativeAlphaError > 0.045)) throw new Error(`Outline expansion changed the rendered footprint: ${JSON.stringify(samples)}`);
  return { svg, evidence: { compiler: "pathkit-wasm@1.0.0", sourceHash: hash(source), outputHash: hash(svg), expandedPaths, samples } };
}
