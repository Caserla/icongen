import type { ProjectTheme } from "../project-themes";

const hex = /^#[0-9a-f]{6}$/i;

type Hsl = { h: number; s: number; l: number };

function hexToHsl(value: string): Hsl {
  const number = Number.parseInt(value.slice(1), 16);
  const r = ((number >> 16) & 255) / 255;
  const g = ((number >> 8) & 255) / 255;
  const b = (number & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex({ h, s, l }: Hsl) {
  const saturation = s / 100, lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lightness - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map(channel => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function wrapHue(value: number) { return (value % 360 + 360) % 360; }

/**
 * One stable illustrative palette per batch. The project theme supplies brand
 * temperature and intensity, while a new split-complementary harmony supplies
 * the actual icon hues. This deliberately avoids per-color tinting.
 */
export function deriveIllustrativePalette(theme: ProjectTheme): ProjectTheme {
  const anchors = [theme.primary, theme.secondary, theme.tertiary, theme.neutral].map(hexToHsl);
  const primary = anchors[0];
  const chromatic = anchors.slice(0, 3);
  const averageSaturation = chromatic.reduce((sum, color) => sum + color.s, 0) / chromatic.length;
  const averageLightness = chromatic.reduce((sum, color) => sum + color.l, 0) / chromatic.length;
  const vivid = Math.min(68, Math.max(54, averageSaturation * 0.4 + 25));
  const baseLight = Math.min(64, Math.max(52, averageLightness * 0.35 + 39));
  return {
    primary: hslToHex({ h: wrapHue(primary.h + 24), s: vivid, l: baseLight }),
    secondary: hslToHex({ h: wrapHue(primary.h + 148), s: Math.max(46, vivid - 10), l: Math.min(67, baseLight + 5) }),
    tertiary: hslToHex({ h: wrapHue(primary.h - 54), s: Math.min(72, vivid), l: Math.min(69, baseLight + 8) }),
    neutral: hslToHex({ h: wrapHue(primary.h + 165), s: 14, l: 70 }),
  };
}

export function isProjectTheme(value: unknown): value is ProjectTheme {
  if (!value || typeof value !== "object") return false;
  const theme = value as Record<string, unknown>;
  return ["primary", "secondary", "tertiary", "neutral"].every(key => typeof theme[key] === "string" && hex.test(theme[key]));
}

export function lockSmartColorsToProject(colors: unknown, projectTheme: unknown) {
  if (!colors || typeof colors !== "object" || !isProjectTheme(projectTheme)) return colors;
  const value = colors as { mode?: unknown; default?: unknown };
  if (value.mode !== "smart") return colors;
  const currentDefault = value.default && typeof value.default === "object" ? value.default as Record<string, unknown> : {};
  const gradient = currentDefault.mode === "linear" || currentDefault.mode === "radial";
  return {
    ...value,
    // Smart mode treats the project theme as a chromatic source, not an
    // exact paint lock. Manual mode keeps the strict values supplied by UI.
    locked: false,
    paletteMode: "adaptive-project-theme",
    palette: projectTheme,
    adaptedPalette: undefined,
    default: gradient
      ? { ...currentDefault, color: projectTheme.primary, endColor: projectTheme.secondary }
      : { ...currentDefault, mode: "solid", color: projectTheme.primary },
  };
}

export function projectPaletteGuidance(colors: unknown) {
  if (!colors || typeof colors !== "object") return null;
  const value = colors as { mode?: unknown; palette?: unknown };
  if (value.mode !== "smart" || !isProjectTheme(value.palette)) return null;
  return `PROJECT_THEME_COLOR_SOURCE: primary ${value.palette.primary}, secondary ${value.palette.secondary}, tertiary ${value.palette.tertiary}, neutral ${value.palette.neutral}. These are reference anchors, not mandatory literal paint values or a restricted color-slot list. Design colors from the subject’s recognizable physical features, materials and the selected substyle. New hues outside the project palette are explicitly allowed when the subject or style calls for them. Coordinate saturation, temperature and contrast with the project when useful, without sacrificing object identity. Do not map project role names mechanically onto object parts or copy unrelated reference subjects’ colors. Respect monochrome, gradient, multicolor and material-specific style rules; do not force four colors or a fixed color-count onto every style. Keep related icons coherent through treatment and repeated material colors, not identical paints for different natural objects.`;
}

export function colorApplicationPolicy(colors: unknown) {
  if (!colors || typeof colors !== "object") return "Use the selected style's color contract.";
  const value = colors as { mode?: unknown };
  return value.mode === "smart"
    ? "SMART COLOR POLICY: design an object-aware, style-compatible palette freely. Project colors are reference only, not mandatory slots or hue limits. Do not copy the four project hex values mechanically. For multicolor and illustrative subjects, infer the characteristic colors of the object and each real component from its identity, material, function and requested context before adjusting lightness or saturation. Preserve color distinctions that support recognition; do not paint unrelated materials identically merely to match a theme. When an object has multiple plausible colors or no intrinsic color, choose a coherent color appropriate to the selected style and context rather than inventing a universal fixed color. Explicit user colors and variants take precedence. Preserve intentional monochrome, gradient and special-material styles rather than forcing literal multicolor rendering onto every style. Project harmony and reference-sheet paints must not override subject identity. Ignore legacy default/adaptedPalette paint suggestions in smart mode; never treat them as locks."
    : "MANUAL COLOR POLICY: the supplied manual solid or gradient values are locked. Use those exact values and do not derive replacements.";
}
