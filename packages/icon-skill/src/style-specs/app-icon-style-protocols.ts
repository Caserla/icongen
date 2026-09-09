import type { IconStylePresetId } from "@icongen/shared";

export type AppIconStyleProtocol = {
  palette: string;
  illustrative: string;
  foregroundIllustrative?: string;
  functional: string;
  depth: string;
  forbidden: string;
  smallSize: string;
};

export const APP_ICON_STYLE_PROTOCOLS: Partial<Record<IconStylePresetId, AppIconStyleProtocol>> = {
  "clay-3d": {
    palette: "2–5 cheerful coordinated colors on matte hand-molded clay",
    illustrative: "Build one friendly subject from a few chunky, soft, inflated, rounded clay forms with one large readable silhouette.",
    functional: "Build one familiar UI symbol from a few compact rounded matte-clay pieces while preserving open negative space.",
    depth: "Use broad soft studio light and gentle contact depth only where forms touch.",
    forbidden: "No ceramic, metal, glass, glossy plastic, gritty texture, dramatic cast shadow, cinematic scene, or miniature clutter.",
    smallSize: "Preserve the main silhouette and one expressive or semantic feature at 48 px.",
  },
  "isometric-3d": {
    palette: "3–5 coordinated clean color blocks with controlled top, left, and right plane contrast",
    illustrative: "Construct one coherent miniature object or compact micro-scene on a consistent isometric grid with a stable three-quarter camera.",
    foregroundIllustrative: "Construct one coherent miniature object or compact micro-scene with parallel projected edges and a stable three-quarter isometric camera.",
    functional: "Construct one familiar UI symbol as a compact isometric object using only the planes required to explain its meaning.",
    depth: "Use one consistent upper light source, physically coherent overlap, and short restrained contact shading.",
    forbidden: "No perspective distortion, floating fragments, crowded diorama scenery, inconsistent camera angles, or photorealistic materials.",
    smallSize: "Keep the main mass and isometric orientation unmistakable at 48 px.",
  },
  "pixel-art": {
    palette: "a limited intentional bright retro palette with clustered solid pixels and clear value separation",
    illustrative: "Design one compact retro-game sprite on one explicit low-resolution square pixel grid with a strong block silhouette.",
    functional: "Design one familiar UI symbol as a compact sprite using the fewest coherent pixel clusters needed for recognition.",
    depth: "Describe volume only with one- or two-step pixel ramps and selective single-pixel highlights.",
    forbidden: "No antialiasing, vector curves, mixed-resolution pixels, continuous gradients, blur, glow haze, or realistic lighting.",
    smallSize: "Preserve a recognizable silhouette at 16–32 px; use single-pixel marks only for essential semantics.",
  },
  "low-poly": {
    palette: "3–5 coordinated colors with deliberate hue and value shifts across adjacent polygon planes",
    illustrative: "Reconstruct one bold subject from a controlled number of large planar facets with a strong outer silhouette.",
    functional: "Reduce one familiar UI symbol to a small number of large readable polygon planes without breaking its standard meaning.",
    depth: "Use one coherent light direction and explain depth through facet orientation.",
    forbidden: "No photographic texture, wireframe, random triangulation, tiny shards, spikes, floating polygons, bevels, or glossy reflections.",
    smallSize: "Use fewer, larger facets around the focal form so it remains readable at 48 px.",
  },
  neon: {
    palette: "electric cyan, blue, vivid violet, hot magenta, and restrained warm amber light",
    illustrative: "Draw one simple emblem or object using a small number of continuous luminous paths with clear negative space.",
    functional: "Draw one familiar UI symbol using continuous consistent-width luminous paths and the minimum number of joins.",
    depth: "Use a bright controlled core and a narrow colored halo that never overwhelms the geometry.",
    forbidden: "No smoke, fog, glow flood, photographic signage, wall texture, illegible light scribbles, or external presentation board.",
    smallSize: "Retain one dominant luminous contour and remove interior light paths before they merge at 48 px.",
  },
  "cute-sticker": {
    palette: "2–4 bright simple colors with limited soft internal tonal separation",
    illustrative: "Create one friendly original character or object with an expressive compact pose, large rounded masses, and one clear sticker silhouette.",
    functional: "Create one familiar rounded UI symbol with exactly one close even cream-white sticker rim.",
    depth: "Keep the subject graphic and mostly flat, using only minimal internal tonal separation.",
    forbidden: "No second rim, canvas-sized white border, card, badge, glossy material, photorealism, text label, or crowded accessories.",
    smallSize: "Preserve the face or semantic gesture and exactly one outer sticker silhouette at 48 px.",
  },
  "flat-illustration": {
    palette: "3–6 coordinated matte flat color regions with deliberate overlaps and large clean graphic layers",
    illustrative: "Create one concise narrative icon scene with one dominant foreground subject and at most one supporting element.",
    functional: "Reduce one familiar UI meaning to one dominant flat symbol and at most one necessary supporting shape.",
    depth: "Explain depth only through overlap, scale, and limited tonal layers rather than realistic lighting.",
    forbidden: "No cast shadows, 3D rendering, stock-illustration collage, complex scenery, texture noise, or painterly shading.",
    smallSize: "The dominant subject must remain recognizable at 48 px.",
  },
  "flat-playful": {
    palette: "2–4 high-saturation matte solid colors selected from teal #20BFAE, blue #2F80ED, yellow #FFB800, coral #FF4F4F, green #65C96B, purple #8B6FD6, and warm white #FFFDF7",
    illustrative: "Use thick rounded simple geometry, an oversized friendly silhouette, cute proportions, an easy-to-read expression, and no more than three essential internal details.",
    functional: "Use rounded lightweight familiar interaction geometry with balanced negative space; express friendliness through proportion and soft turns rather than decoration.",
    depth: "For illustrative subjects, add restrained structural depth only through overlap, one darker same-hue side plane, or one separate layered color block while keeping 80%–90% flatness. Functional symbols remain flat.",
    forbidden: "No muted corporate styling, large gradients, glossy plastic, mirror highlights, anime eye rendering, realistic texture, cast shadow, outer glow, painterly shading, or realistic 3D lighting.",
    smallSize: "Keep the silhouette and one semantic feature clear at 48 px; merge subordinate details into the nearest major color plane.",
  },
  "minimal-logo": {
    palette: "one or two flat colors with strong figure-ground contrast",
    illustrative: "Reduce the subject to one original dominant silhouette or a disciplined relationship between two essential geometric forms.",
    functional: "Reduce the UI meaning to one optically balanced original mark with purposeful negative space.",
    depth: "Use a completely flat vector-like construction with precise curves or deliberate straight segments.",
    forbidden: "No text, initials, stock-logo swooshes, mockup embossing, decorative gradients, shadows, material simulation, or secondary scenes.",
    smallSize: "The mark must remain distinct at 24–32 px and in a single-color silhouette test.",
  },
};

export function getAppIconStyleProtocol(preset: IconStylePresetId) {
  const protocol = APP_ICON_STYLE_PROTOCOLS[preset];
  if (!protocol) throw new Error(`Missing app icon style protocol for ${preset}`);
  return protocol;
}
