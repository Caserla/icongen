import type { ImageProcessor } from "@icongen/backend-core";
import sharp from "sharp";

export class SharpImageProcessor implements ImageProcessor {
  async inspect(input: { bytes: Uint8Array }) {
    const metadata = await sharp(input.bytes).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Generated image dimensions could not be read");
    return { width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha ?? false };
  }

  async process(input: { bytes: Uint8Array; size: number }) {
    const { data, info } = await sharp(input.bytes)
      .resize(input.size, input.size, { fit: "contain", position: "centre", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { bytes: data, mimeType: "image/png" as const, width: info.width, height: info.height, hasAlpha: info.channels === 4 };
  }
}
