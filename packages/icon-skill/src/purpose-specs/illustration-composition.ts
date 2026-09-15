import type { CompileIconPromptInput } from "../types";

export function compileIllustrationComposition(
  input: CompileIconPromptInput,
) {
  switch (input.illustrationComposition ?? "centered") {
    case "edge-anchored":
      if (!input.background.enabled)
        return "EDGE-ANCHORED TRANSPARENT COMPOSITION (MANDATORY): Build one intentionally off-center foreground subject cluster. Let substantial foreground forms enter from and crop through one selected canvas edge, while the focal product, functional motif, and required brand name remain clear. Do not add a backdrop, environment field, presentation tile, floor, horizon, or scenery behind the subject. Every gap within and around the foreground forms must be true alpha transparency. Avoid a small centered object, equal empty margins, or a symmetrical product-display pose.";
      return "EDGE-ANCHORED COMPOSITION (MANDATORY): Use an intentionally off-center visual balance. Anchor a substantial part of the subject or scene to the left, right, or lower edge so the composition enters from and visually continues beyond that boundary. Keep the key product, functional motif, and required brand name fully legible; peripheral scenery may be naturally cropped by the canvas. Avoid a small centered object, equal empty margins, or a symmetrical product-display pose.";
    case "full-bleed-scene":
      if (!input.background.enabled)
        return "FULL-BLEED TRANSPARENT FOREGROUND COMPOSITION (MANDATORY): Create an immersive foreground-only cluster rather than a centered isolated object. Expand the principal product and meaningful supporting foreground objects across the canvas so multiple forms intentionally continue through several edges. Do not generate any backdrop, sky, wall, floor, horizon, scenery field, colored panel, or checkerboard. Keep all negative space and openings between the foreground objects as true alpha transparency. Keep the functional motif and complete brand name clear.";
      return "FULL-BLEED SCENE COMPOSITION (MANDATORY): Treat the background container as a window into one cohesive illustrated scene. Extend environmental forms, surfaces, supporting objects, color, and depth to every edge and corner so the scene fills the container. Integrate the main subject into that environment instead of floating it in the center. Keep the key product, functional motif, and required brand name clear; allow only peripheral scenery to continue beyond the frame.";
    default:
      return "CENTERED COMPOSITION: Present one complete principal subject around the optical center with balanced margins and a clear silhouette.";
  }
}

export function compileIllustrationSubjectScale(
  input: CompileIconPromptInput,
) {
  const occupancy = input.style.subjectSizePercent;
  switch (input.illustrationComposition ?? "centered") {
    case "edge-anchored":
      if (!input.background.enabled)
        return `SUBJECT SIZE PARAMETER (MANDATORY): Make the focal product or functional motif occupy approximately ${occupancy}% of the canvas width or height. Build a larger foreground-only cluster that meets one selected edge; crop only supporting foreground forms there. Preserve true alpha in every remaining gap and keep the complete brand name readable.`;
      return `SUBJECT SIZE PARAMETER (MANDATORY): Make the principal product or functional motif occupy approximately ${occupancy}% of the canvas width or height. Place that focal motif visibly off center and let the larger subject cluster or supporting scene meet and continue beyond one selected edge. The edge crop must look intentional, not like a centered object that was accidentally clipped. Keep the brand name and essential functional cue fully readable.`;
    case "full-bleed-scene":
      if (!input.background.enabled)
        return `SUBJECT SIZE PARAMETER (MANDATORY): Make the focal product or functional motif occupy approximately ${occupancy}% of the canvas width or height, then extend related foreground objects toward and through multiple edges. Create a broad immersive cluster without a background field; retain true alpha wherever no foreground object exists. Do not shrink it into a centered object with equal margins.`;
      return `SUBJECT SIZE PARAMETER (MANDATORY): Make the principal product or functional motif occupy approximately ${occupancy}% of the canvas width or height while the surrounding illustrated scene extends across the full canvas. Fill every edge and corner with meaningful scene content; do not shrink the composition into a centered object with empty margins. Keep the brand name and essential functional cue fully readable.`;
    default:
      return `SUBJECT SIZE PARAMETER (MANDATORY): Fit the complete principal subject to an optical bounding box occupying approximately ${occupancy}% of the available canvas width or height, whichever dimension limits it first. Preserve the full silhouette without cropping and do not compensate by adding a background panel, frame, ground plane, or oversized secondary object.`;
  }
}

export function compileIllustrationProductionBoundary(
  input: CompileIconPromptInput,
) {
  switch (input.illustrationComposition ?? "centered") {
    case "edge-anchored":
      if (!input.background.enabled)
        return "Keep the focal product, functional cue, and required brand name clear. Only supporting foreground forms may crop at the deliberately selected edge. Preserve true alpha outside and between all foreground forms; do not recenter or synthesize a background surface.";
      return "Keep the focal product, functional cue, and required brand name clear and readable. Supporting forms may be cropped only at the deliberately selected edge and must visibly continue beyond it. Do not recenter the composition, restore equal margins, or place the artwork inside an inset panel.";
    case "full-bleed-scene":
      if (!input.background.enabled)
        return "Keep the focal product, functional cue, and required brand name clear while supporting foreground forms continue through multiple canvas edges. The immersive coverage must come from foreground objects only. Preserve true alpha in every uncovered area; never add a background field, tile, floor, wall, sky, or checkerboard.";
      return "Keep the focal product, functional cue, and required brand name clear and readable while the cohesive scene continues through every canvas edge and corner. Do not recenter the composition, restore empty safe margins, isolate the subject on a presentation tile, or reduce the scene to a floating object.";
    default:
      return "Keep every visible element complete, centered, uncropped, and inside balanced safe margins.";
  }
}
