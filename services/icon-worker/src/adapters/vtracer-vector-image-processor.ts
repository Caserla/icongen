import type { VectorImageProcessor } from "@icongen/backend-core";
import { ColorMode, Hierarchical, OptimizePreset, PathSimplifyMode, optimize, readImage, vectorize } from "@neplex/vectorizer";
import sharp from "sharp";

const MIN_ALPHA = 48;
const MAX_VECTOR_PATHS = 256;

function toHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

async function dominantOpaqueColor(source: Buffer) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { count: number; red: number; green: number; blue: number }>();
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] < 160) continue;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const key = `${red >> 4}:${green >> 4}:${blue >> 4}`;
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((left, right) => right.count - left.count)[0];
  if (!dominant) return "#000000";
  return `#${toHex(dominant.red / dominant.count)}${toHex(dominant.green / dominant.count)}${toHex(dominant.blue / dominant.count)}`;
}

async function cleanAlpha(source: Buffer) {
  const image = sharp(source).ensureAlpha();
  const metadata = await image.metadata();
  const rgb = await image.removeAlpha().png({ palette: true, colours: 24, dither: 0 }).toBuffer();
  const alpha = await sharp(source)
    .ensureAlpha()
    .extractChannel(3)
    .median(3)
    .threshold(MIN_ALPHA)
    .raw()
    .toBuffer();
  return sharp(rgb)
    .joinChannel(alpha, { raw: { width: metadata.width!, height: metadata.height!, channels: 1 } })
    .png()
    .toBuffer();
}

function assertUsableSvg(svg: string) {
  const pathCount = svg.match(/<path\b/g)?.length ?? 0;
  if (pathCount === 0) throw new Error("Vectorization produced no paths");
  if (pathCount > MAX_VECTOR_PATHS) throw new Error(`Vectorization produced too many paths (${pathCount})`);
  if (/<image\b/i.test(svg)) throw new Error("Vectorization embedded a raster image");
}

export class VTracerVectorImageProcessor implements VectorImageProcessor {
  async process(input: { bytes: Uint8Array; mode: "binary" | "color" }) {
    const original = Buffer.from(input.bytes);
    const foregroundColor = input.mode === "binary" ? await dominantOpaqueColor(original) : undefined;
    const source = input.mode === "binary"
      ? await sharp(original).ensureAlpha().extractChannel(3).negate().threshold(127).png().toBuffer()
      : await cleanAlpha(original);
    const image = await readImage(source);
    const svg = await vectorize(source, {
      colorMode: input.mode === "binary" ? ColorMode.Binary : ColorMode.Color,
      hierarchical: Hierarchical.Stacked,
      filterSpeckle: 6,
      colorPrecision: input.mode === "binary" ? 2 : 6,
      layerDifference: 12,
      mode: PathSimplifyMode.Spline,
      cornerThreshold: 60,
      lengthThreshold: 4,
      maxIterations: 6,
      spliceThreshold: 45,
      pathPrecision: 3,
    });
    let safeSvg = await optimize(svg, { preset: OptimizePreset.Safe, multipass: true, multipassIterations: 3 });
    if (foregroundColor) safeSvg = safeSvg.replace(/fill=["']#(?:000000|000)["']/gi, `fill="${foregroundColor}"`);
    if (/<(?:script|foreignObject)\b|\son\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|data:)/i.test(safeSvg)) throw new Error("Unsafe SVG content was produced");
    assertUsableSvg(safeSvg);
    return { bytes: new TextEncoder().encode(safeSvg), mimeType: "image/svg+xml" as const, width: image.width, height: image.height };
  }
}
