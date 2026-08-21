export const DESIGN_SETTINGS_VERSION = "core-settings-2026-08-20.1" as const;

export type LocalizedLabel = { en: string; zh: string };

type CoreOption = {
  id: string;
  label: LocalizedLabel;
  promptToken: string;
};

type CoreGroup = {
  id: string;
  label: LocalizedLabel;
  options: readonly CoreOption[];
};

const option = (id: string, en: string, zh: string, promptToken = id): CoreOption => ({
  id, label: { en, zh }, promptToken,
});

export const CORE_SETTING_GROUPS = [
  {
    id: "graphicStructure", label: { en: "Graphic structure", zh: "图形结构" }, options: [
      option("outline", "Outline", "线性", "outline UI icon"),
      option("filled", "Filled", "面性", "filled UI icon"),
      option("line-fill", "Line + Fill", "线面结合", "line and fill UI icon"),
      option("duotone", "Duotone", "双色分层", "duotone layered UI icon"),
    ],
  },
  {
    id: "visualTone", label: { en: "Visual tone", zh: "视觉气质" }, options: [
      option("neutral", "Neutral", "中性"), option("rounded", "Rounded", "圆润"),
      option("bold", "Bold", "醒目"), option("playful", "Playful", "活泼"),
      option("technical", "Technical", "技术感"),
    ],
  },
  {
    id: "strokeWeight", label: { en: "Stroke weight", zh: "线条粗细" }, options: [
      option("light", "Light", "细"), option("regular", "Regular", "常规"),
      option("medium", "Medium", "中粗"), option("bold", "Bold", "粗"),
    ],
  },
  {
    id: "colorMode", label: { en: "Color mode", zh: "配色方式" }, options: [
      option("monochrome", "Monochrome", "单色"), option("two-tone", "Two-tone", "两色"),
      option("multicolor", "Multicolor", "多色"), option("gradient", "Gradient", "渐变"),
    ],
  },
  {
    id: "backgroundContainer", label: { en: "Background container", zh: "背景容器" }, options: [
      option("none", "None", "无背景"), option("circle", "Circle", "圆形"),
      option("square", "Square", "方形"), option("rounded-square", "Rounded Square", "圆角方形"),
      option("pill", "Pill", "胶囊形"),
    ],
  },
  {
    id: "detailLevel", label: { en: "Detail level", zh: "细节程度" }, options: [
      option("auto", "Auto", "自动"), option("minimal", "Minimal", "极简"),
      option("standard", "Standard", "标准"),
    ],
  },
] as const satisfies readonly CoreGroup[];

// These are Skill-owned defaults, not user-facing settings in MVP.
export const CORE_SYSTEM_DEFAULTS = {
  representation: "UI glyph",
  camera: "front orthographic",
  material: "flat",
  shadow: "none",
  consistencyLock: true,
} as const;

export function validateCoreSettingsCatalog() {
  const errors: string[] = [];
  const optionIds = new Set<string>();
  for (const group of CORE_SETTING_GROUPS) {
    for (const item of group.options) {
      const namespacedId = `${group.id}.${item.id}`;
      if (optionIds.has(namespacedId)) errors.push(`duplicate core option: ${namespacedId}`);
      optionIds.add(namespacedId);
    }
  }
  if (CORE_SETTING_GROUPS.length !== 6) errors.push(`expected 6 groups, got ${CORE_SETTING_GROUPS.length}`);
  if (optionIds.size !== 25) errors.push(`expected 25 options, got ${optionIds.size}`);
  return { valid: errors.length === 0, errors, groupCount: CORE_SETTING_GROUPS.length, optionCount: optionIds.size };
}
