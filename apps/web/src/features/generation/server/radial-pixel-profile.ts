import { z } from "zod";
import { validateGeneratedSvg } from "./validate-generated-svg";

/** One executable silhouette primitive for objects with genuinely repeated radial teeth/rays. */
export const radialPixelProfileSchema = z.object({
  size: z.number().int().min(16).max(48).default(24),
  center: z.tuple([z.number().finite(), z.number().finite()]),
  count: z.number().int().min(4).max(16),
  rootRadius: z.number().positive().max(24),
  tipRadius: z.number().positive().max(24),
  holeRadius: z.number().min(0).max(16),
  tipFraction: z.number().min(0.2).max(0.75),
}).strict().refine(value => value.tipRadius > value.rootRadius + 1 && value.rootRadius > value.holeRadius + 2, "Radial teeth, body and hole need separable dimensions");
export type RadialPixelProfile = z.input<typeof radialPixelProfileSchema>;

export function renderRadialPixelProfile(input: RadialPixelProfile, color: string) {
  const p = radialPixelProfileSchema.parse(input);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Invalid radial pixel color");
  const sector = Math.PI * 2 / p.count;
  const mask = new Uint8Array(p.size * p.size);
  for (let y = 0; y < p.size; y++) for (let x = 0; x < p.size; x++) {
    const dx = x + 0.5 - p.center[0], dy = y + 0.5 - p.center[1];
    const r = Math.hypot(dx, dy);
    const delta = Math.abs(((Math.atan2(dy, dx) + sector / 2 + Math.PI * 8) % sector) - sector / 2);
    const outer = delta <= sector * p.tipFraction / 2 ? p.tipRadius : p.rootRadius;
    mask[y * p.size + x] = r >= p.holeRadius && r <= outer ? 1 : 0;
  }
  const clean = mask.slice();
  for (let y = 1; y < p.size - 1; y++) for (let x = 1; x < p.size - 1; x++) {
    const i = y * p.size + x;
    const adjacent = mask[i - 1] + mask[i + 1] + mask[i - p.size] + mask[i + p.size];
    if (mask[i] && adjacent <= 1) clean[i] = 0;
    else if (!mask[i] && adjacent >= 3) clean[i] = 1;
  }
  let d = "";
  for (let y = 0; y < p.size; y++) {
    for (let x = 0; x < p.size;) {
      if (!clean[y * p.size + x]) { x++; continue; }
      const start = x;
      do { x++; } while (x < p.size && clean[y * p.size + x]);
      d += `M${start} ${y}h${x - start}v1h-${x - start}z`;
    }
  }
  return validateGeneratedSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.size} ${p.size}" shape-rendering="crispEdges"><path d="${d}" fill="${color.toUpperCase()}"/></svg>`);
}
