import type { ImageProcessor } from "@icongen/backend-core";
import sharp from "sharp";

function repairDarkTransparentFringe(
  source: Buffer,
  width: number,
  height: number,
  channels: number,
) {
  if (channels !== 4) return source;
  const output = Buffer.from(source);
  const colorMax = (offset: number) =>
    Math.max(source[offset], source[offset + 1], source[offset + 2]);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * channels;
    const alpha = source[offset + 3];
    if (alpha === 0) {
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      continue;
    }
    if (alpha > 64 || colorMax(offset) >= 56) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    let coloredNeighbor = -1;
    let hasDarkArtworkNeighbor = false;
    for (let radius = 1; radius <= 3 && coloredNeighbor < 0; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = (ny * width + nx) * channels;
          const neighborAlpha = source[neighbor + 3];
          if (neighborAlpha < 96) continue;
          if (colorMax(neighbor) < 56) {
            hasDarkArtworkNeighbor = true;
            continue;
          }
          coloredNeighbor = neighbor;
          break;
        }
        if (coloredNeighbor >= 0) break;
      }
    }
    if (hasDarkArtworkNeighbor || coloredNeighbor < 0) continue;
    output[offset] = source[coloredNeighbor];
    output[offset + 1] = source[coloredNeighbor + 1];
    output[offset + 2] = source[coloredNeighbor + 2];
  }
  return output;
}

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

  async restoreAlphaMask(input: {
    bytes: Uint8Array;
    alphaSourceBytes: Uint8Array;
  }) {
    const metadata = await sharp(input.bytes).metadata();
    if (!metadata.width || !metadata.height)
      throw new Error("Generated image dimensions could not be read");
    const alpha = await sharp(input.alphaSourceBytes)
      .resize(metadata.width, metadata.height, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      })
      .ensureAlpha()
      .extractChannel("alpha")
      .raw()
      .toBuffer();
    const { data, info } = await sharp(input.bytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let pixel = 0; pixel < metadata.width * metadata.height; pixel += 1) {
      data[pixel * info.channels + 3] = alpha[pixel];
    }
    const repaired = repairDarkTransparentFringe(
      data,
      info.width,
      info.height,
      info.channels,
    );
    const encoded = await sharp(repaired, {
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
    const repaired = repairDarkTransparentFringe(
      output,
      info.width,
      info.height,
      info.channels,
    );
    const encoded = await sharp(repaired, {
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
      // Fully transparent pixels must not retain the temporary key color.
      // Some browser/image resize paths interpolate hidden RGB values before
      // compositing alpha, which otherwise exposes a green fringe.
      output[offset] = 0;
      output[offset + 1] = 0;
      output[offset + 2] = 0;
      output[offset + 3] = 0;
      const x = pixel % width;
      if (x > 0) enqueue(pixel - 1);
      if (x + 1 < width) enqueue(pixel + 1);
      if (pixel >= width) enqueue(pixel - width);
      if (pixel + width < pixelCount) enqueue(pixel + width);
    }

    // Remove chroma spill from the one-pixel antialiased boundary without
    // touching green artwork away from the transparent canvas edge.
    const boundaryPixels = new Set<number>();
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      if (!visited[pixel]) continue;
      const x = pixel % width;
      if (x > 0 && !visited[pixel - 1]) boundaryPixels.add(pixel - 1);
      if (x + 1 < width && !visited[pixel + 1]) boundaryPixels.add(pixel + 1);
      if (pixel >= width && !visited[pixel - width]) boundaryPixels.add(pixel - width);
      if (pixel + width < pixelCount && !visited[pixel + width]) boundaryPixels.add(pixel + width);
    }
    for (const pixel of boundaryPixels) {
      const offset = pixel * channels;
      const red = output[offset];
      const green = output[offset + 1];
      const blue = output[offset + 2];
      const greenSpill = green - Math.max(red, blue);
      if (greenSpill <= 20) continue;
      output[offset + 1] = Math.max(red, blue);
      output[offset + 3] = Math.min(
        output[offset + 3],
        Math.round(255 * (1 - Math.min(greenSpill, 255) / 255)),
      );
    }
    const repaired = repairDarkTransparentFringe(output, width, height, 4);
    const encoded = await sharp(repaired, {
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
    const { data: resized, info } = await pipeline
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const repaired = repairDarkTransparentFringe(
      resized,
      info.width,
      info.height,
      info.channels,
    );
    const data = await sharp(repaired, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    return { bytes: data, mimeType: "image/png" as const, width: info.width, height: info.height, hasAlpha: true };
  }
}
