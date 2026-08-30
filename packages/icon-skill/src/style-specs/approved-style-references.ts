import type { IconStylePresetId } from "@icongen/shared";

export type ApprovedStyleReference = {
  assetFile: string;
  source: "generated-and-approved" | "flat-playful-icon-library";
  visualSignature: string;
};

export const APPROVED_APP_ICON_STYLE_REFERENCES: Partial<Record<IconStylePresetId, ApprovedStyleReference>> = {
  "clay-3d": {
    assetFile: "clay-3d.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: cheerful matte soft-clay forms, rounded hand-molded masses, broad studio light, gentle contact depth, and a balanced blue, green, yellow, coral, purple, and warm-neutral palette.",
  },
  "isometric-3d": {
    assetFile: "isometric-3d.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: consistent three-quarter isometric camera, clean separated planes, compact object scale, coordinated blue, green, yellow, coral, purple, and warm-neutral color blocks, and restrained contact shading.",
  },
  "pixel-art": {
    assetFile: "pixel-art.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: one coherent low-resolution pixel grid, strong block silhouettes, limited bright retro palette, integer-pixel details, hard nearest-neighbor edges, and no antialiasing.",
  },
  "low-poly": {
    assetFile: "low-poly.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: bold readable silhouettes made from a controlled number of large planar facets, coherent upper light, deliberate blue, green, yellow, coral, purple, and neutral plane contrast, and no random shards.",
  },
  neon: {
    assetFile: "neon.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: deep midnight violet-to-indigo background with balanced electric cyan, vivid violet, hot magenta, and restrained warm amber neon paths; bright cores, narrow halos, and immediately readable symbols.",
  },
  "cute-sticker": {
    assetFile: "cute-sticker.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: friendly compact subjects, bright simple colors, limited soft internal shading, and exactly one clean cream-white sticker rim closely following each silhouette.",
  },
  "flat-illustration": {
    assetFile: "flat-illustration.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: modern vector-like flat illustration, large coordinated matte color regions, clear foreground hierarchy, deliberate overlaps, restrained tonal layers, and a warm-neutral presentation palette.",
  },
  "flat-playful": {
    assetFile: "flat-playful.png",
    source: "flat-playful-icon-library",
    visualSignature: "Approved reference signature copied from flat-playful-icon-library: high-saturation teal, blue, yellow, coral, green, purple, and warm-white color blocks; rounded friendly geometry; clean closed silhouettes; and restrained structural depth.",
  },
  "minimal-logo": {
    assetFile: "minimal-logo.png",
    source: "generated-and-approved",
    visualSignature: "Approved reference signature: strict flat minimalist marks on warm white, distributed graphite, peacock teal, coral red, and muted mustard solids, one or two colors per mark, purposeful negative space, and no effects.",
  },
};

export function getApprovedStyleReference(preset: IconStylePresetId) {
  return APPROVED_APP_ICON_STYLE_REFERENCES[preset];
}
