export type IconGenerationCategory = {
  id: string;
  icon: string;
  label: { en: string; zh: string };
  children: Array<{ id: string; label: { en: string; zh: string } }>;
};

export const ICON_GENERATION_CATEGORIES: IconGenerationCategory[] = [
  { id: "outline-linear", icon: "/generation/style-categories/outline-linear.svg", label: { en: "Outline / Linear", zh: "线性描边" }, children: [
    { id: "thin", label: { en: "Thin", zh: "纤细" } }, { id: "light", label: { en: "Light", zh: "轻量" } },
    { id: "regular", label: { en: "Regular", zh: "常规" } }, { id: "bold-outline", label: { en: "Bold", zh: "粗线" } },
    { id: "broken-outline", label: { en: "Broken Outline", zh: "断线描边" } },
  ] },
  { id: "filled-solid", icon: "/generation/style-categories/filled-solid.svg", label: { en: "Filled / Solid", zh: "实心剪影" }, children: [
    { id: "pure-solid", label: { en: "Pure Solid", zh: "纯实心" } }, { id: "cutout", label: { en: "Cutout", zh: "镂空" } },
    { id: "state-pair", label: { en: "State Pair", zh: "状态配对" } },
  ] },
  { id: "rounded", icon: "/generation/style-categories/rounded.svg", label: { en: "Rounded", zh: "圆润造型" }, children: [
    { id: "soft-rounded", label: { en: "Soft Rounded", zh: "轻圆角" } }, { id: "fully-rounded", label: { en: "Fully Rounded", zh: "饱满圆润" } },
    { id: "rounded-fill", label: { en: "Rounded Fill", zh: "圆润实心" } },
  ] },
  { id: "sharp-geometric", icon: "/generation/style-categories/sharp-geometric.svg", label: { en: "Sharp / Geometric", zh: "锐角几何" }, children: [
    { id: "sharp", label: { en: "Sharp", zh: "锐角" } }, { id: "angular", label: { en: "Angular", zh: "折线" } },
    { id: "grid-based", label: { en: "Grid-based", zh: "网格化" } },
  ] },
  { id: "duotone", icon: "/generation/style-categories/duotone.svg", label: { en: "Duotone", zh: "双色层次" }, children: [
    { id: "outline-duotone", label: { en: "Outline Duotone", zh: "线面双色" } }, { id: "filled-duotone", label: { en: "Filled Duotone", zh: "双层实心" } },
    { id: "two-color", label: { en: "Two-color", zh: "对比双色" } },
  ] },
  { id: "hierarchical", icon: "/generation/style-categories/hierarchical.svg", label: { en: "Hierarchical", zh: "同色分层" }, children: [
    { id: "two-level", label: { en: "2-Level", zh: "两级" } }, { id: "three-level", label: { en: "3-Level", zh: "三级" } },
    { id: "outline-fill", label: { en: "Outline + Fill", zh: "线面分层" } },
  ] },
  { id: "multicolor", icon: "/generation/style-categories/multicolor.svg", label: { en: "Multicolor", zh: "多彩语义" }, children: [
    { id: "semantic", label: { en: "Semantic", zh: "语义配色" } }, { id: "palette", label: { en: "Palette", zh: "统一色板" } },
    { id: "illustrative", label: { en: "Illustrative", zh: "插画多彩" } },
  ] },
  { id: "soft-filled-pastel", icon: "/generation/style-categories/soft-filled-pastel.svg", label: { en: "Soft Filled / Pastel", zh: "柔和填充" }, children: [
    { id: "mono-pastel", label: { en: "Mono Pastel", zh: "单色柔彩" } }, { id: "soft-two-tone", label: { en: "Soft Two-tone", zh: "柔和双色" } },
    { id: "background-tile", label: { en: "Background Tile", zh: "柔彩底板" } },
  ] },
  { id: "gradient", icon: "/generation/style-categories/gradient.svg", label: { en: "Gradient", zh: "渐变色彩" }, children: [
    { id: "gradient-outline", label: { en: "Linear Outline", zh: "渐变描边" } }, { id: "gradient-fill", label: { en: "Linear Fill", zh: "线性渐变面" } },
    { id: "radial", label: { en: "Radial", zh: "径向渐变" } }, { id: "multi-stop", label: { en: "Multi-stop", zh: "多色渐变" } },
  ] },
  { id: "3d-clay", icon: "/generation/style-categories/3d-clay.svg", label: { en: "3D / Clay", zh: "立体物件" }, children: [
    { id: "clay", label: { en: "Clay", zh: "黏土哑光" } }, { id: "plastic", label: { en: "Plastic", zh: "亮面塑料" } },
    { id: "extruded", label: { en: "Extruded", zh: "挤出厚度" } }, { id: "isometric", label: { en: "Isometric", zh: "等距视角" } },
  ] },
  { id: "glass-translucent", icon: "/generation/style-categories/glass-translucent.svg", label: { en: "Glass / Translucent", zh: "半透明玻璃" }, children: [
    { id: "frosted", label: { en: "Frosted", zh: "磨砂" } }, { id: "clear", label: { en: "Clear", zh: "清透" } },
    { id: "tinted", label: { en: "Tinted", zh: "染色玻璃" } },
  ] },
  { id: "hand-drawn-doodle", icon: "/generation/style-categories/hand-drawn-doodle.svg", label: { en: "Hand-drawn / Doodle", zh: "手绘涂鸦" }, children: [
    { id: "sketch", label: { en: "Sketch", zh: "草图复线" } }, { id: "doodle", label: { en: "Doodle", zh: "自由涂鸦" } },
    { id: "colored-doodle", label: { en: "Colored Doodle", zh: "彩色涂鸦" } },
  ] },
  { id: "pixel", icon: "/generation/style-categories/pixel.svg", label: { en: "Pixel", zh: "像素栅格" }, children: [
    { id: "pixel-outline", label: { en: "Pixel Outline", zh: "像素线框" } }, { id: "pixel-solid", label: { en: "Pixel Solid", zh: "像素实心" } },
    { id: "pixel-color", label: { en: "Color Pixel", zh: "彩色像素" } },
  ] },
  { id: "neon-glow", icon: "/generation/style-categories/neon-glow.svg", label: { en: "Neon / Glow", zh: "霓虹发光" }, children: [
    { id: "neon-tube", label: { en: "Neon Tube", zh: "霓虹灯管" } }, { id: "soft-glow", label: { en: "Soft Glow", zh: "柔光实心" } },
    { id: "dual-neon", label: { en: "Dual Neon", zh: "双色霓虹" } },
  ] },
];
