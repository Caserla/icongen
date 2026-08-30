import type { VectorImageProcessor } from "@icongen/backend-core";
import { ColorMode, Hierarchical, OptimizePreset, PathSimplifyMode, optimize, readImage, vectorize } from "@neplex/vectorizer";
import sharp from "sharp";

export class VTracerVectorImageProcessor implements VectorImageProcessor {
  async process(input: { bytes: Uint8Array; mode: "binary" | "color" }) {
    const original = Buffer.from(input.bytes);
    const source = input.mode === "binary"
      ? await sharp(original).flatten({ background: "#ffffff" }).grayscale().threshold(190).png().toBuffer()
      : original;
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
    const safeSvg = await optimize(svg, { preset: OptimizePreset.Safe, multipass: true, multipassIterations: 3 });
    if (/<(?:script|foreignObject)\b|\son\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?:https?:|data:)/i.test(safeSvg)) throw new Error("Unsafe SVG content was produced");
    return { bytes: new TextEncoder().encode(safeSvg), mimeType: "image/svg+xml" as const, width: image.width, height: image.height };
  }
}
