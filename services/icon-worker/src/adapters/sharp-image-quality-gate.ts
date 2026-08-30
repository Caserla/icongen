import type { ImageQualityGate, ImageQualityWarning } from "@icongen/backend-core";
import sharp from "sharp";

const MIN_SOURCE_EDGE = 1024;
const CORNER_SAMPLE_RATIO = 0.08;
const DARK_LUMINANCE = 48;
const DARK_CORNER_FRACTION = 0.55;
const CHECKER_SAMPLE_SIZE = 64;
const FLAT_BACKGROUND_SAMPLE_SIZE = 64;
const FLAT_BACKGROUND_BORDER_WIDTH = 8;

function standardDeviation(values: number[], mean: number) {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length);
}

async function hasPaintedTransparencyCheckerboard(bytes: Uint8Array) {
  const { data, info } = await sharp(bytes)
    .resize(CHECKER_SAMPLE_SIZE, CHECKER_SAMPLE_SIZE, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (const period of [2, 4, 8, 16]) {
    const groups: [number[], number[]] = [[], []];
    let opaquePixels = 0;
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha < 230) continue;
      opaquePixels += 1;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      if (maximum - minimum > 18 || luminance < 135) continue;
      groups[(Math.floor(x / period) + Math.floor(y / period)) % 2 as 0 | 1].push(luminance);
    }
    if (opaquePixels === 0 || groups[0].length + groups[1].length < opaquePixels * 0.28 || groups[0].length < 120 || groups[1].length < 120) continue;
    const means = groups.map((values) => values.reduce((sum, value) => sum + value, 0) / values.length);
    if (Math.abs(means[0] - means[1]) >= 10 && standardDeviation(groups[0], means[0]) <= 24 && standardDeviation(groups[1], means[1]) <= 24) return true;
  }
  return false;
}

function colorDistance(red: number, green: number, blue: number, reference: [number, number, number]) {
  return Math.sqrt((red - reference[0]) ** 2 + (green - reference[1]) ** 2 + (blue - reference[2]) ** 2);
}

function parseHexColor(value: string): [number, number, number] {
  return [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)];
}

async function inspectConnectedSolidBackground(bytes: Uint8Array, contract: Extract<NonNullable<Parameters<ImageQualityGate["inspect"]>[0]["backgroundContract"]>, { mode: "solid" }>) {
  const { data, info } = await sharp(bytes)
    .resize(FLAT_BACKGROUND_SAMPLE_SIZE, FLAT_BACKGROUND_SAMPLE_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cornerSize = 4;
  const cornerPixels: Array<[number, number, number]> = [];
  for (const [left, top] of [[0, 0], [info.width - cornerSize, 0], [0, info.height - cornerSize], [info.width - cornerSize, info.height - cornerSize]]) {
    for (let y = top; y < top + cornerSize; y += 1) for (let x = left; x < left + cornerSize; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      cornerPixels.push([data[offset], data[offset + 1], data[offset + 2]]);
    }
  }
  const reference = ([0, 1, 2].map((channel) => {
    const values = cornerPixels.map((pixel) => pixel[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }) as [number, number, number]);

  const totalPixels = info.width * info.height;
  const connected = new Uint8Array(totalPixels);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    const index = y * info.width + x;
    if (connected[index]) return;
    const offset = index * info.channels;
    if (colorDistance(data[offset], data[offset + 1], data[offset + 2], reference) > contract.colorTolerance) return;
    connected[index] = 1;
    queue.push(index);
  };
  enqueue(0, 0); enqueue(info.width - 1, 0); enqueue(0, info.height - 1); enqueue(info.width - 1, info.height - 1);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < info.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < info.height) enqueue(x, y + 1);
  }

  let borderPixels = 0;
  let connectedBorderPixels = 0;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (x < FLAT_BACKGROUND_BORDER_WIDTH || y < FLAT_BACKGROUND_BORDER_WIDTH || x >= info.width - FLAT_BACKGROUND_BORDER_WIDTH || y >= info.height - FLAT_BACKGROUND_BORDER_WIDTH) {
      borderPixels += 1;
      if (connected[y * info.width + x]) connectedBorderPixels += 1;
    }
  }
  const borderCoverage = connectedBorderPixels / borderPixels;
  const canvasCoverage = queue.length / totalPixels;
  const targetDistance = colorDistance(reference[0], reference[1], reference[2], parseHexColor(contract.color));
  return { invalid: borderCoverage < contract.minBorderCoverage || canvasCoverage < contract.minCanvasCoverage || targetDistance > contract.targetTolerance, borderCoverage, canvasCoverage, targetDistance, observedColor: `rgb(${reference.join(",")})` };
}

export class SharpImageQualityGate implements ImageQualityGate {
  async inspect(input: Parameters<ImageQualityGate["inspect"]>[0]) {
    const image = sharp(input.bytes);
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Generated image dimensions could not be read for quality inspection");
    const warnings: ImageQualityWarning[] = [];

    if (Math.min(metadata.width, metadata.height) < MIN_SOURCE_EDGE) warnings.push({ code: "SOURCE_TOO_SMALL", message: `Source image is ${metadata.width}×${metadata.height}; expected a minimum edge of ${MIN_SOURCE_EDGE}px.` });
    if (metadata.width !== metadata.height) warnings.push({ code: "SOURCE_NOT_SQUARE", message: `Source image is ${metadata.width}×${metadata.height}; expected a square production asset.` });
    if (await hasPaintedTransparencyCheckerboard(input.bytes)) warnings.push({ code: "FAKE_TRANSPARENCY_CHECKERBOARD", message: "The image appears to contain an opaque painted checkerboard instead of native transparency." });
    if (input.purpose === "app-icon" && input.stylePreset && input.backgroundContract?.mode === "solid") {
      const result = await inspectConnectedSolidBackground(input.bytes, input.backgroundContract);
      if (result.invalid) warnings.push({ code: "NON_UNIFORM_SOLID_BACKGROUND", message: `The ${input.stylePreset} background failed its ${input.backgroundContract.profile} profile: borderCoverage=${result.borderCoverage.toFixed(3)}, canvasCoverage=${result.canvasCoverage.toFixed(3)}, targetDistance=${result.targetDistance.toFixed(1)}, required=${input.backgroundContract.minBorderCoverage.toFixed(3)}/${input.backgroundContract.minCanvasCoverage.toFixed(3)}, tolerances=${input.backgroundContract.colorTolerance}/${input.backgroundContract.targetTolerance}, observed=${result.observedColor}, target=${input.backgroundContract.color}.` });
    }

    // A dark outer field is intentional for the approved neon gradient. Keep
    // this presentation-backdrop warning for every other app-icon style.
    if (input.purpose === "app-icon" && input.stylePreset !== "neon") {
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
