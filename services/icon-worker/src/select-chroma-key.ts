import sharp from "sharp";

export type ChromaColor = { red: number; green: number; blue: number };

const CANDIDATES: ChromaColor[] = [
  { red: 0, green: 255, blue: 0 },
  { red: 255, green: 0, blue: 255 },
  { red: 0, green: 128, blue: 255 },
];

export async function selectChromaKey(bytes: Uint8Array): Promise<ChromaColor> {
  const { data, info } = await sharp(bytes)
    .resize(96, 96, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let best = CANDIDATES[0];
  let bestScore = -1;
  for (const candidate of CANDIDATES) {
    let minimum = Number.POSITIVE_INFINITY;
    let total = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += info.channels) {
      if (data[index + 3] <= 32) continue;
      const distance = Math.sqrt(
        (data[index] - candidate.red) ** 2 +
          (data[index + 1] - candidate.green) ** 2 +
          (data[index + 2] - candidate.blue) ** 2,
      );
      minimum = Math.min(minimum, distance);
      total += distance;
      count += 1;
    }
    const score = count === 0 ? 255 : minimum * 0.75 + (total / count) * 0.25;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function chromaHex(color: ChromaColor) {
  return `#${[color.red, color.green, color.blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}
