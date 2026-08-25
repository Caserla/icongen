import type { ImageQualityGate, ImageQualityWarning } from "@icongen/backend-core";
import sharp from "sharp";

const MIN_SOURCE_EDGE = 1024;
const CORNER_SAMPLE_RATIO = 0.08;
const DARK_LUMINANCE = 48;
const DARK_CORNER_FRACTION = 0.55;

export class SharpImageQualityGate implements ImageQualityGate {
  async inspect(input: Parameters<ImageQualityGate["inspect"]>[0]) {
    const image = sharp(input.bytes);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Generated image dimensions could not be read for quality inspection");
    const warnings: ImageQualityWarning[] = [];

    if (Math.min(metadata.width, metadata.height) < MIN_SOURCE_EDGE) warnings.push({ code: "SOURCE_TOO_SMALL", message: `Source image is ${metadata.width}×${metadata.height}; expected a minimum edge of ${MIN_SOURCE_EDGE}px.` });
    if (metadata.width !== metadata.height) warnings.push({ code: "SOURCE_NOT_SQUARE", message: `Source image is ${metadata.width}×${metadata.height}; expected a square production asset.` });

    if (input.purpose === "app-icon") {
      const size = Math.max(1, Math.round(Math.min(metadata.width, metadata.height) * CORNER_SAMPLE_RATIO));
      const { data, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const corners = [
        [0, 0], [info.width - size, 0], [0, info.height - size], [info.width - size, info.height - size],
      ];
      let darkPixels = 0;
      let sampledPixels = 0;
      for (const [left, top] of corners) {
        for (let y = top; y < top + size; y += 1) for (let x = left; x < left + size; x += 1) {
          const offset = (y * info.width + x) * info.channels;
          const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
          if (luminance < DARK_LUMINANCE) darkPixels += 1;
          sampledPixels += 1;
        }
      }
      if (sampledPixels > 0 && darkPixels / sampledPixels >= DARK_CORNER_FRACTION) warnings.push({ code: "APP_ICON_DARK_OUTER_CORNERS", message: "Most sampled outer-corner pixels are very dark; the image may contain an unwanted external presentation backdrop." });
    }

    return warnings;
  }
}
