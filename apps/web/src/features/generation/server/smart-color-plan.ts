import { z } from "zod";
import specification from "../../../../../../docs/design/smart-color-selection-v1.json";
import type { ColorIntent } from "../generation-intent";
import { contrastRatio, oklchHex, perceptualDistance, toLch } from "./color-math";
import { isLibraryGenerationStyle } from "../library-generation-styles";

// Six library styles share one neutral ink. Bulk/Twotone vary opacity and
// geometry, not hue. Reuse the neutral recipe without adding six 46-style slots.
const colorSpecificationId = (styleId: string) => isLibraryGenerationStyle(styleId) ? "regular" : styleId;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const variant = z.object({ roles: z.record(z.string(), hex), gradientStops: z.array(hex).max(3).optional() });
export const smartColorPlanSchema = z.object({
  version: z.literal("1.0"), id: z.string().max(80), styleId: z.string().max(80), grammar: z.string().max(80), recipeId: z.string().max(80),
  theme: z.enum(["light", "dark"]), targetSurface: hex, references: z.array(hex).max(4),
  variants: z.object({ light: variant, dark: variant }),
  partColors: z.array(z.object({ subjectName: z.string().max(80), part: z.string().max(80), color: hex, source: z.enum(["explicit", "semantic"]), evidence: z.string().max(800) })).max(120),
  explicitForeground: hex.optional(), reason: z.string().max(1200),
}).superRefine((plan, context) => {
  const style = specification.styles.find(item => item.id === colorSpecificationId(plan.styleId));
  const legacyDoodleInk = plan.styleId === "doodle" && plan.grammar === "neutral-one-paint" && plan.recipeId === "neutral-ink";
  if (!style || (style.grammar !== plan.grammar && !legacyDoodleInk) || !style.recipes.includes(plan.recipeId)) context.addIssue({ code: "custom", message: "Color plan/style mismatch" });
  const grammar = specification.grammars[plan.grammar as keyof typeof specification.grammars];
  if (grammar) for (const theme of ["light", "dark"] as const) {
    for (const role of grammar.roles) if (!plan.variants[theme].roles[role]) context.addIssue({ code: "custom", message: `Missing ${theme}/${role}` });
    if ("stops" in grammar && plan.variants[theme].gradientStops?.length !== grammar.stops.length) context.addIssue({ code: "custom", message: "Gradient stop count mismatch" });
  }
});
export type SmartColorPlan = z.infer<typeof smartColorPlanSchema>;
type Recipe = (typeof specification.recipes)[number];
const hash = (value: string) => { let n = 2166136261; for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619); return (n >>> 0).toString(16); };

export function readSmartColorPlan(colors: unknown): SmartColorPlan | null {
  if (!colors || typeof colors !== "object" || !("smartColorPlan" in colors)) return null;
  const result = smartColorPlanSchema.safeParse(colors.smartColorPlan);
  return result.success ? result.data : null;
}

/** Local bounded color derivation. No additional model call or aesthetic rejection loop. */
function resolvePaint(color: string, background: string, references: string[], minContrast = 0, explicit = false) {
  if (explicit) return color.toUpperCase();
  const initial = toLch(color);
  const candidates = [0, -0.04, 0.04, -0.08, 0.08].map(delta => {
    let l = Math.max(0.12, Math.min(0.96, initial.l + delta));
    let paint = delta === 0 ? color.toUpperCase() : oklchHex({ ...initial, l });
    const lighter = contrastRatio("#FFFFFF", background) > contrastRatio("#000000", background);
    for (let i = 0; i < 85 && contrastRatio(paint, background) < minContrast; i++) {
      l = Math.max(0.08, Math.min(0.98, l + (lighter ? 0.01 : -0.01)));
      paint = oklchHex({ ...initial, l });
    }
    return { paint, distance: Math.min(1, ...references.map(reference => perceptualDistance(paint, reference))), movement: Math.abs(l - initial.l) };
  }).filter(candidate => !references.includes(candidate.paint));
  const readable = candidates.filter(candidate => contrastRatio(candidate.paint, background) >= minContrast);
  const pool = readable.length ? readable : candidates;
  return pool.sort((a, b) => (a.movement + Math.max(0, 0.035 - a.distance) * 4) - (b.movement + Math.max(0, 0.035 - b.distance) * 4))[0]?.paint
    ?? oklchHex({ ...initial, l: Math.max(0.12, initial.l - 0.12) });
}

function makeVariant(recipe: Recipe, grammar: string, theme: "light" | "dark", background: string, references: string[], foreground?: string, styleId?: string) {
  const seed = recipe[theme];
  const dark = theme === "dark";
  const base = foreground ?? seed.body;
  const lch = toLch(base);
  const paint = (color: string, min = 0) => resolvePaint(color, background, references, min, color === foreground);
  const tone = (l: number, chroma = lch.c) => paint(oklchHex({ ...lch, l, c: chroma }));
  const readableTone = (l: number, c = lch.c) => paint(oklchHex({ ...lch, l, c }), 3);
  const roles: Record<string, string> = {};
  let gradientStops: string[] | undefined;
  switch (grammar) {
    case "neutral-one-paint": roles.ink = paint(foreground ?? seed.ink, 4.5); break;
    case "doodle-ink":
      roles.ink = paint(foreground ?? seed.ink, 4.5);
      roles.accent = paint(dark ? "#D5B889" : "#B69462");
      break;
    case "duotone-outline": roles.ink = foreground ? paint(base) : readableTone(dark ? 0.84 : 0.51); roles.support = tone(dark ? 0.50 : 0.85, lch.c * 0.55); break;
    case "duotone-flat": roles.body = foreground ? paint(base) : tone(dark ? 0.83 : 0.78, lch.c * 0.55); roles.support = readableTone(dark ? 0.60 : 0.51, lch.c); break;
    case "contrast-flat": roles.body = paint(base, 3); roles.companion = paint(seed.companion, 3); break;
    case "alpha-two": case "alpha-three": case "outline-alpha": roles.body = paint(base, 4.5); break;
    case "pastel-one-hue": roles.body = tone(dark ? 0.68 : 0.85, 0.065); roles.ink = readableTone(dark ? 0.86 : 0.64, 0.06); break;
    case "pastel-two-hue": roles.body = tone(dark ? 0.71 : 0.82, 0.07); roles.companion = paint(oklchHex({ ...toLch(seed.companion), l: dark ? 0.79 : 0.78, c: 0.065 })); roles.ink = readableTone(dark ? 0.88 : 0.62, 0.06); break;
    case "pastel-tile": roles.ink = paint(base, 3); roles.support = tone(dark ? 0.38 : 0.92, 0.035); break;
    case "gradient-two": case "gradient-three": case "neon-dual": {
      const ramp = grammar === "gradient-three" && "gradientThree" in recipe ? recipe.gradientThree?.[theme] : undefined;
      const endpoints = ramp ?? ("gradient" in recipe && recipe.gradient ? recipe.gradient[theme] : [base, tone(dark ? 0.85 : 0.49)]);
      roles.gradientStart = paint(foreground ?? endpoints[0], 3);
      roles.gradientEnd = paint(endpoints[endpoints.length - 1], 3);
      if (grammar === "gradient-three") {
        roles.gradientMid = paint(ramp?.[1] ?? seed.companion, 3);
      }
      gradientStops = [roles.gradientStart, ...(roles.gradientMid ? [roles.gradientMid] : []), roles.gradientEnd];
      break;
    }
    case "gradient-radial": roles.gradientStart = readableTone(dark ? 0.86 : 0.62); roles.gradientEnd = readableTone(dark ? 0.67 : 0.46); gradientStops = [roles.gradientStart, roles.gradientEnd]; break;
    case "material-volume": {
      const matte = styleId === "clay";
      roles.body = paint(base, styleId === "isometric" ? 0 : 3);
      roles.shade = tone(Math.max(0.22, lch.l - (matte ? 0.12 : 0.18)));
      roles.highlight = tone(Math.min(0.94, lch.l + (matte ? 0.11 : 0.20)), lch.c * (matte ? 0.75 : 0.4));
      break;
    }
    case "colored-pixel":
      roles.body = paint(base);
      roles.support = paint(seed.support);
      roles.accent = paint(seed.accent);
      roles.ink = paint(seed.ink, 4.5);
      break;
    case "material-glass": {
      roles.tint = foreground ? paint(base) : styleId === "clear" ? tone(dark ? 0.80 : 0.93, 0.018)
        : styleId === "tinted" ? tone(dark ? 0.75 : 0.70, 0.12) : tone(dark ? 0.78 : 0.88, 0.035);
      roles.rim = readableTone(dark ? 0.84 : 0.63, styleId === "tinted" ? 0.09 : 0.045);
      roles.highlight = paint(seed.highlight);
      break;
    }
    case "neon-single":
      roles.body = paint(base, 3);
      // The narrow envelope carries boundary contrast; emission is not dark ink.
      roles.core = foreground ? tone(dark ? 0.94 : 0.90, Math.min(lch.c, 0.08)) : paint(seed.highlight);
      roles.halo = foreground ? paint(base) : paint(seed.support);
      break;
    case "glow-single": roles.body = paint(base, 3); roles.halo = roles.body; break;
    default: roles.body = paint(base, 3); roles.support = paint(seed.support); roles.accent = paint(seed.accent); roles.ink = paint(seed.ink, 3);
  }
  return { roles, ...(gradientStops ? { gradientStops } : {}) };
}

export function createSmartColorPlan(input: { styleId: string; theme?: "light" | "dark"; targetSurface?: string; projectColors?: string[]; intent?: ColorIntent }): SmartColorPlan {
  const style = specification.styles.find(item => item.id === colorSpecificationId(input.styleId));
  if (!style) throw new Error(`Unknown color style: ${input.styleId}`);
  const theme = input.theme ?? "light";
  const references = [...new Set((input.projectColors ?? []).filter(color => hex.safeParse(color).success).map(color => color.toUpperCase()))].sort().slice(0, 4);
  const candidates = specification.recipes.filter(recipe => style.recipes.includes(recipe.id));
  const desired = candidates.find(recipe => recipe.id === input.intent?.recipeId);
  if (input.intent?.recipeId && !desired && !input.intent.foreground) throw new Error("描述中的配色方向与所选风格不兼容，请调整配色描述或切换风格。");
  // Compare whole recipes. Never derive a hue by averaging project colors.
  const referenceChroma = references.length ? references.reduce((sum, value) => sum + toLch(value).c, 0) / references.length : 0.12;
  const cost = (recipe: Recipe) => {
    const rank = style.recipes.indexOf(recipe.id) * 0.025;
    const distance = Math.min(1, ...references.map(reference => perceptualDistance(recipe[theme].body, reference)));
    return rank + Math.max(0, 0.045 - distance) * 8 + Math.abs(toLch(recipe[theme].body).c - referenceChroma) * 0.12;
  };
  const stylePreferred = !input.intent?.foreground && (input.styleId === "isometric" || input.styleId === "pixel-color")
    ? candidates.find(recipe => recipe.id === (input.styleId === "isometric" ? "soft-violet" : "pixel-sorbet"))
    : undefined;
  const recipe = desired ?? stylePreferred ?? [...candidates].sort((a, b) => cost(a) - cost(b))[0];
  const targetSurface = hex.safeParse(input.targetSurface).success ? input.targetSurface! : theme === "dark" ? specification.backgrounds.referenceDark : specification.backgrounds.referenceLight;
  const foreground = input.intent?.foreground;
  const variants = Object.fromEntries((["light", "dark"] as const).map(surface => [surface, makeVariant(recipe, style.grammar, surface,
    surface === theme ? targetSurface : surface === "dark" ? specification.backgrounds.referenceDark : specification.backgrounds.referenceLight, references, foreground, style.id)])) as SmartColorPlan["variants"];
  const partColors = (input.intent?.partColors ?? []).map(item => ({ ...item, color: resolvePaint(item.color, targetSurface, references, 0, item.source === "explicit") }));
  const data = { version: "1.0" as const, styleId: input.styleId, grammar: style.grammar, recipeId: recipe.id, theme, targetSurface, references, variants, partColors,
    ...(foreground ? { explicitForeground: foreground } : {}), reason: `${recipe.name}；${style.notes}${desired ? " 用户明确指定配色方向。" : " 按风格选择完整配方，项目四色只作同权协调参考。"}` };
  return smartColorPlanSchema.parse({ ...data, id: `color-v1-${hash(JSON.stringify(data))}` });
}

/** Compatibility fields are derived from roles, not four mandatory paint slots. */
export function colorPlanCompatibility(plan: SmartColorPlan) {
  const roles = plan.variants[plan.theme].roles;
  const primary = roles.body ?? roles.ink ?? roles.gradientStart ?? roles.tint;
  return { primary, secondary: roles.support ?? roles.companion ?? roles.gradientEnd ?? roles.shade ?? roles.rim ?? roles.ink ?? primary,
    tertiary: roles.gradientMid ?? roles.accent ?? roles.highlight ?? primary, neutral: roles.ink ?? roles.rim ?? primary };
}

export function smartColorPlanPrompt(plan: SmartColorPlan) {
  const grammar = specification.grammars[plan.grammar as keyof typeof specification.grammars];
  const style = specification.styles.find(item => item.id === colorSpecificationId(plan.styleId));
  // Shared palette-role schema stays compatible with saved plans. Rendering
  // can differ: Illustrative uses base hues with flat structural depth regions.
  const renderingRule = style && "renderingRule" in style ? style.renderingRule : grammar.rule;
  const paints = { styleId: plan.styleId, theme: plan.theme, targetSurface: plan.targetSurface, references: plan.references, ...plan.variants[plan.theme] };
  return `BATCH STYLE PALETTE / SAVED COLOR PLAN: ${JSON.stringify(paints)}\nSELECTED_STYLE_COLOR_GRAMMAR: ${renderingRule}\n${specification.generationPrompt.join("\n")}\nThese defaults are NOT mandatory paint slots. Object/material color identity takes precedence within the style grammar. For ordinary monochrome use the saved ink as the only foreground hue; doodle-ink additionally permits its saved tiny accent marks. Read subject-scoped partColors from INPUT_JSON.colors.smartColorPlan; only apply assignments matching INPUT_JSON.subject.name. The plan was frozen before dispatch. Do not reselect on retry. Explicit user overrides listed in that plan may match project colors; other visible paints must not copy the project references. Structural mask black/white are exempt. Background is for contrast assessment, never a painted canvas. Return the color assignments in the existing designCard.`;
}
