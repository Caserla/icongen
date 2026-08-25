import type { IconStylePresetId } from "@icongen/shared";

const APP_ICON_STYLE_SPECS: Partial<Record<IconStylePresetId, string>> = {
  "clay-3d": [
    "Geometry and composition: one chunky rounded subject built from a few soft inflated forms, centered in a frontal or gentle three-quarter view with a large readable silhouette.",
    "Color and material: 2–5 cheerful colors on matte hand-molded clay, with subtle material variation but no gritty, ceramic, metallic, glass, or plastic surfaces.",
    "Lighting and depth: broad soft studio light, gentle ambient occlusion at real form contacts, restrained depth, and no dramatic cast shadow or cinematic scene.",
    "Edges and detail: smooth tactile edges, simplified facial or functional details, no hairline texture, fingerprints, excessive seams, or miniature clutter.",
    "Small-size rule: preserve the main silhouette and one expressive feature at 48px; remove secondary props before reducing the subject.",
  ].join(" "),
  "isometric-3d": [
    "Geometry and composition: one coherent miniature object or micro-scene constructed on a consistent isometric grid with a stable three-quarter camera and clearly separated top, left, and right planes.",
    "Color and material: clean coordinated color blocks with controlled plane contrast; materials remain stylized and readable rather than photorealistic.",
    "Lighting and depth: one consistent upper light source, short restrained contact shading, and physically coherent overlap without perspective distortion.",
    "Edges and detail: precise architectural edges, orderly spatial hierarchy, and only a few meaningful small components; no floating fragments or crowded diorama scenery.",
    "Small-size rule: the main mass and isometric orientation must remain obvious at 48px; merge tiny structures into larger color planes.",
  ].join(" "),
  "pixel-art": [
    "Geometry and composition: one compact retro-game sprite with a strong block silhouette, centered on an explicit square pixel grid and designed at a low logical resolution.",
    "Color and material: a limited intentional palette with clustered pixels and clear value separation; use solid pixel regions rather than smooth painted transitions.",
    "Lighting and depth: describe volume with one- or two-step pixel ramps and selective highlights, never continuous gradients, blur, glow haze, or realistic lighting.",
    "Edges and detail: hard nearest-neighbor pixel edges, consistent pixel scale, no vector curves, no antialiasing, no mixed-resolution pixels, and no noisy dithering unless structurally useful.",
    "Small-size rule: preserve a recognizable silhouette at 16–32px and reserve single-pixel marks only for essential semantic details.",
  ].join(" "),
  "low-poly": [
    "Geometry and composition: one bold subject reconstructed from a controlled number of large planar facets, with a strong outer silhouette and a clear front or three-quarter orientation.",
    "Color and material: adjacent polygon planes use deliberate hue and value shifts; keep surfaces clean and graphic without photographic texture, wireframes, or random triangulation.",
    "Lighting and depth: a single coherent light direction explains plane changes; depth comes from facet orientation, not heavy shadows, bevels, or glossy reflections.",
    "Edges and detail: crisp straight facet boundaries, strategically simplified anatomy or structure, and no tiny shards, spikes, floating polygons, or chaotic tessellation.",
    "Small-size rule: use fewer larger facets around the focal form so the subject remains readable at 48px.",
  ].join(" "),
  neon: [
    "Geometry and composition: one simple emblem or object drawn with a small number of continuous luminous paths, centered and separated clearly from its own full-canvas background.",
    "Color and background: cyan, electric blue, magenta, and violet light over an intentional deep-blue-to-indigo background with sufficient local contrast.",
    "Lighting and depth: a bright controlled core with a narrow colored halo; glow supports the geometry but never floods the canvas or erases negative space.",
    "Edges and detail: smooth consistent tube width, clean terminals and joins, no illegible light scribbles, photographic signage, wall texture, smoke, or external black presentation board.",
    "Small-size rule: retain one dominant luminous contour and reduce interior light paths before they merge at 48px.",
  ].join(" "),
  "cute-sticker": [
    "Geometry and composition: one friendly original character or object with an expressive compact pose, large rounded masses, and a clear sticker silhouette.",
    "Color and material: bright simple colors with limited soft internal shading; the subject remains graphic rather than plush, glossy, or photorealistic.",
    "Edge language: one clean even sticker rim follows the subject closely as part of the design, without creating a second card, badge, or canvas-sized border.",
    "Detail and expression: use a simple readable face or gesture and at most one necessary supporting symbol; no decorative star clouds, text labels, or crowded accessories.",
    "Small-size rule: preserve the face or semantic gesture and the single outer sticker silhouette at 48px.",
  ].join(" "),
  "flat-illustration": [
    "Geometry and composition: one concise narrative app-icon scene with a dominant foreground subject, at most one supporting element, and a clear foreground/midground hierarchy.",
    "Color and material: 3–6 coordinated flat color regions with deliberate overlaps and large clean graphic layers; surfaces remain matte and illustration-led.",
    "Lighting and depth: depth is explained by overlap, scale, and limited tonal layers rather than realistic perspective, cast shadows, or 3D rendering.",
    "Edges and detail: crisp vector-like curves, controlled internal detail, no stock-illustration collage, complex scenery, texture noise, or thin decorative lines.",
    "Small-size rule: the dominant subject must remain recognizable at 48px; collapse background narrative into one supporting shape when necessary.",
  ].join(" "),
  "flat-playful": [
    "Geometry and composition: one friendly subject built from thick rounded simple geometry, a buoyant compact pose, and a memorable silhouette with balanced safe margins.",
    "Color and material: 2–4 high-saturation solid colors with clear warm/cool separation, matte flat surfaces, and no muddy business palette.",
    "Lighting and depth: preserve an 80–90% flat appearance; show restrained structural depth only through overlap, one darker side plane, or one separate layered color block.",
    "Edges and detail: crisp closed shapes, smooth rounded turns, simple friendly features, and no realistic texture, glossy plastic, mirror highlight, cast shadow, external glow, dramatic 3D lighting, or brand-character imitation.",
    "Small-size rule: keep the main silhouette and one semantic or expressive feature clear at 48px; remove decorative micro-detail first.",
  ].join(" "),
  "minimal-logo": [
    "Geometry and composition: one original compact mark reduced to one dominant silhouette or a disciplined relationship between two essential geometric forms.",
    "Color and material: use one or two flat colors with strong figure-ground contrast; no illustration palette, material simulation, or decorative color noise.",
    "Shape language: precise vector-like curves or deliberate straight segments, optically balanced proportions, and purposeful negative space.",
    "Edges and detail: no text, initials, generic stock-logo swooshes, mockup embossing, gradients used as decoration, shadows, or secondary scene elements.",
    "Small-size rule: the mark must remain distinct at 24–32px and in a single-color silhouette test.",
  ].join(" "),
};

export function getAppIconStyleSpec(preset: IconStylePresetId, fallback: string) {
  return APP_ICON_STYLE_SPECS[preset] ?? fallback;
}
