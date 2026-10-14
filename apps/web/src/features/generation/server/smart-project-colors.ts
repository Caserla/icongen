import type { ProjectTheme } from "../project-themes";
import { isMonochromeStyle } from "../monochrome-svg";
import type { ColorIntent } from "../generation-intent";
import { colorPlanCompatibility, createSmartColorPlan, readSmartColorPlan, smartColorPlanPrompt } from "./smart-color-plan";

export const COLOR_POLICY_VERSION = "4.0";

export function prefersNeutralIconColor(styleId: string) {
  return isMonochromeStyle(styleId) && !["mono-pastel", "neon-tube", "soft-glow"].includes(styleId);
}
export const NEUTRAL_ICON_COLOR_PROMPT = `For ordinary monochrome UI styles (outline, solid, state-pair, rounded, sharp, sketch and monochrome pixel), prefer familiar neutral icon paints: charcoal #202020–#383838 or dark gray #404040–#606060 on light surfaces. RGB channel spread should be at most 12; avoid visibly purple, blue or other chromatic tints. On explicitly dark surfaces prefer light neutral gray #B0B0B0–#E0E0E0. Choose a new value outside the four project colors. Preserve special pastel/neon/glow and multicolor style identities; this neutral preference does not apply to them.`;

const hex = /^#[0-9a-f]{6}$/i;

/** Resolve once from the saved batch snapshot, never from each model output. */
export function uniformSmartBatchColors(colors: unknown, styleId = "", theme: "light" | "dark" = "light", intent?: ColorIntent, targetSurface?: string) {
  if (!colors || typeof colors !== "object") return colors;
  const value = colors as Record<string, unknown>;
  if (value.mode !== "smart") return colors;
  const saved = readSmartColorPlan(value);
  if (value.smartColorPlan && !saved) throw new Error("Saved color plan is invalid; refusing to silently reselect colors");
  if (saved) {
    if (styleId && saved.styleId !== styleId) throw new Error("Saved color plan belongs to another style");
    return colors;
  }
  // Historical successful collections must never be recolored by a policy upgrade.
  const validBatchColor = typeof value.batchColor === "string" && hex.test(value.batchColor);
  if (value.colorPolicyVersion && (isProjectTheme(value.adaptedPalette) || validBatchColor)) return colors;
  const previousDefault = value.default as { mode?: string; color?: string } | undefined;
  // Older monochrome collections predate the policy-version field. An exact
  // saved batch/default lock is sufficient evidence; don't recolor their retry.
  if (prefersNeutralIconColor(styleId) && validBatchColor && value.locked === true
      && previousDefault?.mode === "solid" && previousDefault.color?.toUpperCase() === String(value.batchColor).toUpperCase()) return colors;
  if (styleId) {
    const plan = createSmartColorPlan({ styleId, theme, targetSurface, projectColors: isProjectTheme(value.palette) ? Object.values(value.palette) : [], intent });
    const single = plan.grammar === "neutral-one-paint";
    const foreground = plan.variants[plan.theme].roles.ink;
    return { ...value, smartColorPlan: plan, colorPolicyVersion: COLOR_POLICY_VERSION, colorStyleId: styleId, colorSurface: theme,
      locked: single, batchColor: single ? foreground : undefined,
      default: single ? { mode: "solid", color: foreground } : undefined,
      adaptedPalette: single ? undefined : colorPlanCompatibility(plan), neutralIconColor: single && !plan.explicitForeground, neutralSurface: theme };
  }
  // Compatibility for historical callers that did not send a style ID.
  const palette = isProjectTheme(value.palette) ? Object.values(value.palette) : [];
  const neutral = prefersNeutralIconColor(styleId) || value.neutralIconColor === true;
  const dark = theme === "dark" || value.neutralSurface === "dark";
  const low = dark ? 176 : 32, high = dark ? 224 : 96;
  const isNeutral = (c: string) => {
    const channels = [1,3,5].map(i => parseInt(c.slice(i,i+2),16));
    return Math.max(...channels) - Math.min(...channels) <= 12 && channels.every(v => v >= low && v <= high);
  };
  const allowed = (candidate: unknown): candidate is string => typeof candidate === "string" && hex.test(candidate)
    && (!neutral || isNeutral(candidate)) && palette.every(anchor => colorDistance(candidate, anchor) >= 40);
  // No default/primary fallback: legacy UI defaults must never select smart paint.
  const grays = Array.from({length: high-low+1}, (_,i) => `#${(low+i).toString(16).padStart(2,'0').repeat(3)}`.toUpperCase());
  const distance = (c: string) => Math.min(...palette.map(p => colorDistance(c,p)), 255);
  // If four gray anchors crowd this range, maximize separation without drifting into purple.
  const neutralFallback = grays.filter(c => !palette.some(p => p.toUpperCase() === c)).sort((a,b) => distance(b)-distance(a))[0];
  const color = allowed(value.batchColor) ? value.batchColor : neutral ? neutralFallback : deriveBatchColor(palette);
  return { ...value, ...(neutral ? {neutralIconColor:true,neutralSurface:dark ? "dark" : "light"} : {}), batchColor: color.toUpperCase(), locked: true, default: { mode: "solid", color: color.toUpperCase() } };
}

type Hsl = { h: number; s: number; l: number };

function colorDistance(a: string, b: string) {
  return Math.hypot(...[1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));
}

/** Deterministic recovery only; equally considers every theme color, never its role. */
function deriveBatchColor(palette: string[]) {
  if (!palette.length) return "#505464";
  const anchors = palette.map(hexToHsl);
  const saturation = Math.min(58, Math.max(18, anchors.reduce((n, c) => n + c.s, 0) / anchors.length));
  const candidates = [42, 32, 56, 68].flatMap(l =>
    [saturation, Math.max(42, saturation)].flatMap(s =>
      Array.from({ length: 36 }, (_, i) => hslToHex({ h: i * 10, s, l }))));
  const eligible = candidates.filter(c => palette.every(p => colorDistance(c, p) >= 40));
  // Closest overall chromatic relationship, subject to a visible separation from all anchors.
  return eligible.sort((a, b) => palette.reduce((n, p) => n + colorDistance(a, p) - colorDistance(b, p), 0))[0] ?? "#505464";
}

export const SMART_BATCH_PLAN_PROMPT = `When colors.mode is smart, return batchColor as a six-digit hex ONLY for ordinary monochrome styles. Special pastel/neon/glow, tonal, multicolor, gradient and material styles use their own batch color grammar and must not be reduced to this one paint. The four project colors are equal-weight harmony references and excluded output paints, not recommended slots; do not privilege primary or inherit default. Ordinary monochrome uses one readable neutral foreground shared by all subjects, outline/solid states and retries. Preserve the requested subjects and each object's meaningful color identity in multicolor styles.`;

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

/**
 * One stable role palette per batch; object-specific color identity can take
 * precedence without changing shared UI-symbol colors or retry defaults.
 */
export function deriveIllustrativePalette(theme: ProjectTheme): ProjectTheme {
  return deriveStylePalette(theme, "illustrative");
}

/** Equal-weight harmony, deterministic across retries and project role order. */
export function deriveStylePalette(theme: ProjectTheme | undefined, styleId: string, surface: "light" | "dark" = "light"): ProjectTheme {
  return colorPlanCompatibility(createSmartColorPlan({ styleId, theme: surface, projectColors: theme ? Object.values(theme) : [] }));
}

function styleColorGrammar(styleId: string) {
  if (styleId === "mono-pastel") return "One chromatic hue: light primary body and darker SAME-HUE secondary boundary. Do not replace either with neutral gray.";
  if (styleId === "doodle") return "Use neutral ink for the actual freehand subject. In smart mode a few tiny warm accent ticks may echo the style reference without becoming object parts; manual one-color remains exact.";
  if (styleId === "isometric") return "Use one coherent volume palette: a broad light front plane, darker connected side planes and a restrained upper-left highlight of the same hue. The color roles describe real spatial faces, not separate overlaid objects.";
  if (styleId === "pixel-color") return "Use a dark crisp pixel boundary. Assign pastel body/support only to distinct real parts or structurally meaningful regions; one continuous material may use only body. Never invent a diagonal clipping split, false part or colored patch merely to spend palette roles. Preserve transparent functional openings.";
  if (["neon-tube", "soft-glow"].includes(styleId)) return "Use the exact primary paint for the crisp subject in every icon. Neon-tube has one uniform chromatic stroke, no gradient or pale highlight. Soft-glow uses the same hue for its permitted translucent halo. Do not lighten the main contour; its target-surface contrast is already planned.";
  if (["two-level", "three-level", "outline-fill"].includes(styleId)) return "Use primary as the ONE base hue with the opacity structure of the selected style, not a collection of different hues.";
  if (["outline-duotone", "filled-duotone", "two-color", "soft-two-tone"].includes(styleId)) return "For generic UI symbols use exactly primary and secondary across the collection; do not invent a third shade per icon. Assign them to real parts and balance COLOR AREA, not just hue. In filled-duotone, primary carries a substantial identity-bearing mass and secondary supports it; a dark small cap above a nearly invisible large body is not balanced. Outline-duotone uses primary boundary and secondary surface. Characteristic object/material colors may take precedence in two-color. No shifted duplicate or invented surface to consume colors.";
  if (["gradient-outline", "gradient-fill", "radial", "multi-stop", "dual-neon"].includes(styleId)) return "Use the exact primary/secondary endpoints for every icon. Ordinary linear gradients have exactly two stops at 0/100%, aligned upper-left to lower-right over the whole subject, not restarted per part. Radial uses the common upper-left center. Only multi-stop adds tertiary as a third stop. Dual-neon uses its prescribed blue-to-magenta hue relationship. Preserve readable edges; no extra pale midpoint or white flash.";
  if (["clay", "plastic", "extruded", "frosted", "clear", "tinted"].includes(styleId)) return "Use a coherent body/shade/highlight system. Derive local lightness from these colors to express material; highlights and mask paints are not limited to palette slots. Preserve target-surface rim contrast.";
  return "These are collection defaults for subjects without inherent color, NOT mandatory paint slots. For generic UI symbols reuse the exact primary body and secondary supporting paints across the batch, with tertiary only for a meaningful small accent. Let the dominant body own the greatest visual area; avoid equally saturated competing masses. A simple symbol may use only primary, or primary plus secondary. Object/material/conventional color identity takes precedence: design appropriate component colors while keeping similar saturation and lightness across the set. Do not repaint every object with the same palette. Repeated materials and semantic roles stay consistent.";
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
  return {
    ...value,
    // Smart mode treats the project theme as a chromatic source, not an
    // exact paint lock. Manual mode keeps the strict values supplied by UI.
    locked: false,
    paletteMode: "adaptive-project-theme",
    palette: projectTheme,
    adaptedPalette: undefined,
    smartColorPlan: undefined,
    colorPolicyVersion: undefined,
    default: undefined,
    batchColor: undefined,
  };
}

export function projectPaletteGuidance(colors: unknown) {
  if (!colors || typeof colors !== "object") return null;
  const saved = readSmartColorPlan(colors);
  if (saved) return smartColorPlanPrompt(saved);
  const adaptedPalette = (colors as { adaptedPalette?: unknown }).adaptedPalette;
  if (isProjectTheme(adaptedPalette)) {
    const styleId = (colors as { colorStyleId?: string }).colorStyleId ?? "";
    const references = (colors as { palette?: unknown }).palette;
    return `BATCH STYLE PALETTE: primary ${adaptedPalette.primary}, secondary ${adaptedPalette.secondary}, tertiary ${adaptedPalette.tertiary}, neutral ${adaptedPalette.neutral}. ${styleColorGrammar(styleId)}${isProjectTheme(references) ? ` Project harmony references (excluded literal output paints, no privileged role): ${Object.values(references).join(", ")}. For characteristic object colors, choose a recognizably correct shade outside these exact values rather than changing the object's color identity.` : ""}`;
  }
  const batchColor = (colors as { batchColor?: string }).batchColor;
  if (batchColor && hex.test(batchColor)) return `BATCH COLOR: Use exactly ${batchColor} as the only foreground hue for every subject and both states. Preserve transparency and structural cutouts. Do not choose colors per subject or copy reference-board colors.`;
  const value = colors as { mode?: unknown; palette?: unknown };
  if (value.mode !== "smart" || !isProjectTheme(value.palette)) return null;
  return `PROJECT_HARMONY_REFERENCES (equal weight; excluded output paints): ${Object.values(value.palette).join(", ")}. Select new colors outside ALL four values; do not use near-identical substitutes. Coordinate temperature, saturation and contrast with the overall palette and selected style. Do not privilege any project color, inherit default paints, or copy reference-sheet colors. Preserve subject recognition and the selected style's color structure.`;
}

export function colorApplicationPolicy(colors: unknown) {
  if (!colors || typeof colors !== "object") return "Use the selected style's color contract.";
  const saved = readSmartColorPlan(colors);
  if (saved) return saved.grammar === "neutral-one-paint"
    ? `SMART BATCH COLOR POLICY: Use exactly ${saved.variants[saved.theme].roles.ink} for every subject, state and retry. Preserve transparent holes and structural masks.`
    : "SMART BATCH PALETTE POLICY: use the saved role plan and subject-scoped semantic assignments. Never replace all paints with one foreground color. No project-primary repaint, new per-icon palette, or neutralization of chromatic special styles.";
  const adaptedPalette = (colors as { adaptedPalette?: unknown }).adaptedPalette;
  if (isProjectTheme(adaptedPalette)) return "SMART BATCH PALETTE POLICY: follow the selected style's color grammar and the batch defaults. Preserve object-aware color exceptions, tonal variation, gradient stops and material highlights. Never replace all paints with one foreground color. The neutral swatch is for appropriate small neutral parts, not a replacement for special chromatic styles.";
  const batchColor = (colors as { batchColor?: string }).batchColor;
  if (batchColor && hex.test(batchColor)) return `SMART BATCH COLOR POLICY: The batch has already selected ${batchColor}. Use this same foreground color for every icon and retry; do not redesign its palette. This overrides other color suggestions. Preserve geometry, transparency, masks and negative space.`;
  const value = colors as { mode?: unknown };
  return value.mode === "smart"
    ? "SMART COLOR POLICY: design object-aware, style-compatible colors OUTSIDE all four project colors. Do not copy the four project hex values mechanically or use near-identical tints. All four are equal-weight harmony references, never suggested paints. Balance temperature, saturation and contrast with the project while preserving subject identity and style. Ignore legacy default/adaptedPalette paints. Never privilege primary."
    : "MANUAL COLOR POLICY: the supplied manual solid or gradient values are locked. Use those exact values and do not derive replacements.";
}
