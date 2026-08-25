export const DESIGN_SETTINGS_VERSION = "icon-style-2026-08-25.7" as const;
export const BACKGROUND_TYPE_OPTION_IDS = ["rounded-square", "circle", "square"] as const;

export type LocalizedLabel = { en: string; zh: string };
export const ICON_STYLE_PRESET_IDS = ["clay-3d", "isometric-3d", "pixel-art", "low-poly", "neon", "cute-sticker", "flat-illustration", "flat-playful", "minimal-logo", "line-icon"] as const;
export type IconStylePresetId = (typeof ICON_STYLE_PRESET_IDS)[number];
export type IconStylePreset = { id: IconStylePresetId; label: LocalizedLabel; description: LocalizedLabel; promptToken: string; previewImage: string };
export type StyleAdjustmentGroup = { id: "strokeWeight" | "cornerStyle" | "detailLevel"; label: LocalizedLabel; options: readonly { id: string; label: LocalizedLabel; promptToken: string }[] };

const option = (id: string, en: string, zh: string, promptToken = id) => ({ id, label: { en, zh }, promptToken });

// A preset is the primary user decision. It locks the rendering language for every icon in one batch.
export const ICON_STYLE_PRESETS: readonly IconStylePreset[] = [
  { id: "clay-3d", label: { en: "Clay 3D", zh: "黏土 3D" }, description: { en: "Soft handmade volume and tactile detail", zh: "柔和手作体积与细腻材质" }, promptToken: "cute clay 3D icon, tactile handmade material, soft dimensional lighting", previewImage: "/images/icon-style-previews/hd-native/clay-3d-elephant-gardener.png" },
  { id: "isometric-3d", label: { en: "Isometric 3D", zh: "等距 3D" }, description: { en: "Structured miniature scenes in isometric view", zh: "等距视角下的精致微缩场景" }, promptToken: "isometric 3D icon, structured miniature scene, consistent three-quarter view", previewImage: "/images/icon-style-previews/hd-native/isometric-3d-observatory.png" },
  { id: "pixel-art", label: { en: "Pixel Art", zh: "像素艺术" }, description: { en: "Crisp retro pixels with readable silhouettes", zh: "清晰复古像素与易识别轮廓" }, promptToken: "pixel art icon, crisp square pixel grid, retro game aesthetic, no smoothing", previewImage: "/images/icon-style-previews/hd-native/pixel-art.png" },
  { id: "low-poly", label: { en: "Low Poly", zh: "低多边形" }, description: { en: "Faceted geometry with bold dimensional color", zh: "鲜明切面结构与立体色彩" }, promptToken: "low-poly icon, clean faceted geometry, bold polygonal color planes", previewImage: "/images/icon-style-previews/hd-native/low-poly-v3.png" },
  { id: "neon", label: { en: "Neon", zh: "霓虹" }, description: { en: "Electric glow on a deep blue-to-violet field", zh: "深蓝至靛紫渐变场景中的高对比霓虹光效" }, promptToken: "neon icon, controlled electric glow, deep blue to indigo violet gradient field, cyan and magenta light", previewImage: "/images/icon-style-previews/hd-native/neon-gradient-v3.png" },
  { id: "cute-sticker", label: { en: "Cute Sticker", zh: "可爱贴纸" }, description: { en: "Friendly characters with a crisp sticker edge", zh: "亲和角色与清晰贴纸描边" }, promptToken: "cute sticker icon, friendly character, bold clean outline, polished sticker edge", previewImage: "/images/icon-style-previews/hd-native/cute-sticker-v3.png" },
  { id: "flat-illustration", label: { en: "Flat Illustration", zh: "扁平插画" }, description: { en: "Narrative scenes with clean graphic layers", zh: "清晰色块构成的叙事插画" }, promptToken: "flat illustration icon, clean layered shapes, narrative composition, crisp edges", previewImage: "/images/icon-style-previews/hd-native/flat-illustration-v3.png" },
  { id: "flat-playful", label: { en: "Playful Flat", zh: "扁平活泼" }, description: { en: "Rounded colorful geometry with a friendly playful character", zh: "高饱和圆润几何与活泼友好的卡通表达" }, promptToken: "playful flat icon, high-saturation rounded geometry, friendly cartoon proportions, restrained structural depth, crisp closed shapes", previewImage: "/images/icon-style-previews/hd-native/flat-playful-v3.png" },
  { id: "minimal-logo", label: { en: "Minimal Logo", zh: "极简标志" }, description: { en: "Simple memorable marks with strong silhouettes", zh: "简洁易记且轮廓鲜明的标志" }, promptToken: "minimal logo icon, strong memorable silhouette, precise vector-like geometry", previewImage: "/images/icon-style-previews/hd-native/minimal-logo-v4.png" },
  { id: "line-icon", label: { en: "Line Icon", zh: "线性图标" }, description: { en: "Bold monochrome outlines with consistent rounded strokes", zh: "稍粗单色线条构成的清晰轮廓" }, promptToken: "modern monochrome monoline UI icon, bold precise outline only, consistent rounded stroke caps and joins, minimal geometry, no fill", previewImage: "/images/icon-style-previews/hd-native/line-icon-home-v2.png" },
];

export const STYLE_ADJUSTMENT_GROUPS: readonly StyleAdjustmentGroup[] = [
  { id: "strokeWeight", label: { en: "Line weight", zh: "线条粗细" }, options: [option("light", "Light", "细", "light line weight"), option("regular", "Regular", "常规", "regular line weight"), option("bold", "Bold", "粗", "bold line weight")] },
  { id: "cornerStyle", label: { en: "Corner language", zh: "转角语言" }, options: [option("soft", "Soft", "圆润", "soft rounded corners and terminals"), option("balanced", "Balanced", "平衡", "balanced corners and terminals"), option("sharp", "Sharp", "利落", "crisp angular corners and terminals")] },
  { id: "detailLevel", label: { en: "Detail density", zh: "细节密度" }, options: [option("minimal", "Minimal", "极简", "minimal details"), option("standard", "Standard", "标准", "standard detail density"), option("detailed", "Detailed", "丰富", "richer but legible details")] },
];

export const CORE_SYSTEM_DEFAULTS = { representation: "UI glyph", camera: "front orthographic", material: "flat", shadow: "none", consistencyLock: true } as const;

export function validateIconStyleCatalog() {
  const errors: string[] = [];
  if (ICON_STYLE_PRESETS.length !== 10) errors.push(`expected 10 style presets, got ${ICON_STYLE_PRESETS.length}`);
  if (new Set(ICON_STYLE_PRESETS.map((preset) => preset.id)).size !== ICON_STYLE_PRESETS.length) errors.push("duplicate style preset");
  if (STYLE_ADJUSTMENT_GROUPS.length !== 3) errors.push(`expected 3 adjustment groups, got ${STYLE_ADJUSTMENT_GROUPS.length}`);
  for (const group of STYLE_ADJUSTMENT_GROUPS) if (new Set(group.options.map((item) => item.id)).size !== group.options.length) errors.push(`duplicate adjustment option in ${group.id}`);
  return { valid: errors.length === 0, errors, presetCount: ICON_STYLE_PRESETS.length, adjustmentGroupCount: STYLE_ADJUSTMENT_GROUPS.length };
}
