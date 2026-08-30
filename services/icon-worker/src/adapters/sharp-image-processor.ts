import type { ImageProcessor } from "@icongen/backend-core";
import sharp from "sharp";

export class SharpImageProcessor implements ImageProcessor {
  async inspect(input: { bytes: Uint8Array }) {
    const metadata = await sharp(input.bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Generated image dimensions could not be read");
    return { width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha ?? false };
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
