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

  async normalizeTransparentBackground(input: {
    bytes: Uint8Array;
    chromaColor: { red: number; green: number; blue: number };
    tolerance: number;
  }) {
    const { data, info } = await sharp(input.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const output = Buffer.from(data);
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    const pixelCount = width * height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;
    const cornerIndexes = [0, width - 1, (height - 1) * width, pixelCount - 1];
    const seedColors = cornerIndexes.map((pixel) => {
      const offset = pixel * channels;
      return [output[offset], output[offset + 1], output[offset + 2]] as const;
    });
    seedColors.push([
      input.chromaColor.red,
      input.chromaColor.green,
      input.chromaColor.blue,
    ]);
    const matchesTemporaryBackground = (pixel: number) => {
      const offset = pixel * channels;
      if (output[offset + 3] < 16) return true;
      return seedColors.some(([red, green, blue]) =>
        Math.sqrt(
          (output[offset] - red) ** 2 +
          (output[offset + 1] - green) ** 2 +
          (output[offset + 2] - blue) ** 2,
        ) <= input.tolerance,
      );
    };
    const enqueue = (pixel: number) => {
      if (pixel < 0 || pixel >= pixelCount || visited[pixel] || !matchesTemporaryBackground(pixel)) return;
      visited[pixel] = 1;
      queue[tail++] = pixel;
    };
    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }
    while (head < tail) {
      const pixel = queue[head++];
      const offset = pixel * channels;
      output[offset + 3] = 0;
      const x = pixel % width;
      if (x > 0) enqueue(pixel - 1);
      if (x + 1 < width) enqueue(pixel + 1);
      if (pixel >= width) enqueue(pixel - width);
      if (pixel + width < pixelCount) enqueue(pixel + width);
    }
    const encoded = await sharp(output, {
      raw: { width, height, channels: 4 },
    }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    return { bytes: encoded, mimeType: "image/png" as const, width, height, hasAlpha: true };
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
