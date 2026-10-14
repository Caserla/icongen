import sharp from "sharp";
import { validateGeneratedSvg } from "./validate-generated-svg";

/** A shared pixel silhouette is painted three ways; siblings never redraw anatomy. */
export async function derivePixelFamily(sourceSvg: string, ink: string, size = 24) {
  validateGeneratedSvg(sourceSvg);
  if (!/^#[0-9a-f]{6}$/i.test(ink)) throw new Error("Pixel ink must be a six-digit hex color");
  if (!Number.isInteger(size) || size < 16 || size > 48) throw new Error("Invalid pixel grid size");
  const { data, info } = await sharp(Buffer.from(sourceSvg)).resize(size, size, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visible = new Uint8Array(size * size);
  for (let i = 0; i < visible.length; i++) visible[i] = data[i * info.channels + 3] >= 96 ? 1 : 0;
  if (!visible.some(Boolean)) throw new Error("Pixel source has no visible geometry at the target grid size");
  let edges = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = y * size + x;
    if (!visible[at]) continue;
    if (y === 0 || !visible[at - size]) edges += `M${x} ${y}h1`;
    if (x === size - 1 || !visible[at + 1]) edges += `M${x + 1} ${y}v1`;
    if (y === size - 1 || !visible[at + size]) edges += `M${x + 1} ${y + 1}h-1`;
    if (x === 0 || !visible[at - 1]) edges += `M${x} ${y + 1}v-1`;
  }
  const svg = (mask: Uint8Array) => {
    let d = "";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size;) {
        if (!mask[y * size + x]) { x++; continue; }
        const start = x;
        do { x++; } while (x < size && mask[y * size + x]);
        d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
      }
    }
    return validateGeneratedSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${d}" fill="${ink.toUpperCase()}"/></svg>`);
  };
  const outline = validateGeneratedSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${edges}" fill="none" stroke="${ink.toUpperCase()}" stroke-width="1" stroke-linecap="square" stroke-linejoin="miter"/></svg>`);
  return { outline, solid: svg(visible), color: sourceSvg };
}
