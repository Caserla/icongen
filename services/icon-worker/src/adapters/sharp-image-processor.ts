import type { ImageProcessor } from "@icongen/backend-core";
import sharp from "sharp";

export class SharpImageProcessor implements ImageProcessor {
  async inspect(input: { bytes: Uint8Array }) {
    const metadata = await sharp(input.bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Generated image dimensions could not be read");
    const hasAlpha = metadata.hasAlpha ?? false;
    let hasTransparency = false;
    if (hasAlpha) {
      const { data, info } = await sharp(input.bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      for (let index = 3; index < data.length; index += info.channels) {
        if (data[index] < 255) {
          hasTransparency = true;
          break;
        }
      }
    }
    return {
      width: metadata.width,
      height: metadata.height,
      hasAlpha,
      hasTransparency,
    };
  }

  async applyRoundedMask(input: { bytes: Uint8Array; cornerRadiusPercent: number }) {
    const metadata = await sharp(input.bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Generated image dimensions could not be read");
    const radius = Math.min(metadata.width, metadata.height) * Math.max(0, Math.min(input.cornerRadiusPercent, 50)) / 100;
    const mask = Buffer.from(`<svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg"><rect width="${metadata.width}" height="${metadata.height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);
    const { data, info } = await sharp(input.bytes)
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, mimeType: "image/png" as const, width: info.width, height: info.height, hasAlpha: true };
  }

  async removeChromaBackground(input: {
    bytes: Uint8Array;
    color: { red: number; green: number; blue: number };
    tolerance: number;
  }) {
    const { data, info } = await sharp(input.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const output = Buffer.from(data);
    for (let index = 0; index < output.length; index += info.channels) {
      const distance = Math.sqrt(
        (output[index] - input.color.red) ** 2 +
          (output[index + 1] - input.color.green) ** 2 +
          (output[index + 2] - input.color.blue) ** 2,
      );
      if (distance <= input.tolerance) output[index + 3] = 0;
      else if (distance <= input.tolerance * 1.6)
        output[index + 3] = Math.min(
          output[index + 3],
          Math.round(
            ((distance - input.tolerance) / (input.tolerance * 0.6)) * 255,
          ),
        );
    }
    const encoded = await sharp(output, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    return {
      bytes: encoded,
      mimeType: "image/png" as const,
      width: info.width,
      height: info.height,
      hasAlpha: true,
    };
  }

  async process(input: { bytes: Uint8Array; size: number; profile?: "icon" | "pixel-art" }) {
    const metadata = await sharp(input.bytes).metadata();
    const isDownscaling = Math.max(metadata.width ?? 0, metadata.height ?? 0) > input.size;
    let pipeline = sharp(input.bytes).resize(input.size, input.size, {
      fit: "contain",
      position: "centre",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: input.profile === "pixel-art" ? sharp.kernel.nearest : sharp.kernel.lanczos3,
    });
    if (input.profile !== "pixel-art" && isDownscaling && input.size <= 256) {
      pipeline = pipeline.sharpen({ sigma: input.size <= 128 ? 0.5 : 0.65 });
    }
    const { data, info } = await pipeline
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, mimeType: "image/png" as const, width: info.width, height: info.height, hasAlpha: info.channels === 4 };
  }
}
