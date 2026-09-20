const MONOCHROME_STYLE_IDS = new Set([
  "thin", "light", "regular", "bold-outline", "broken-outline",
  "pure-solid", "cutout", "state-pair",
  "soft-rounded", "fully-rounded", "rounded-fill",
  "sharp", "angular", "grid-based", "mono-pastel",
  "sketch", "doodle", "pixel-outline", "pixel-solid",
  "neon-tube", "soft-glow",
]);

export function isMonochromeStyle(styleId: string) { return MONOCHROME_STYLE_IDS.has(styleId); }

function normalizeHex(value: string) {
  const hex = value.trim().toLowerCase();
  if (/^#[\da-f]{3}$/.test(hex)) return `#${[...hex.slice(1)].map(char => char + char).join("")}`;
  if (/^#[\da-f]{4}$/.test(hex)) return `#${[...hex.slice(1, 4)].map(char => char + char).join("")}${hex[4]}${hex[4]}`;
  if (/^#[\da-f]{6}([\da-f]{2})?$/.test(hex)) return hex;
  return null;
}

export function monochromeSvgColor(svg: string) {
  const paints = new Set<string>();
  const matcher = /(?:\b(?:fill|stroke|stop-color)\s*=\s*["']([^"']+)["']|\b(?:fill|stroke|stop-color)\s*:\s*([^;"'}]+))/gi;
  for (const match of svg.matchAll(matcher)) {
    const raw = (match[1] ?? match[2] ?? "").trim();
    if (!raw || raw === "none" || raw === "transparent") continue;
    const normalized = normalizeHex(raw);
    if (!normalized) return null;
    paints.add(normalized.slice(0, 7));
    if (paints.size > 1) return null;
  }
  return paints.size === 1 ? [...paints][0] : null;
}

export function recolorMonochromeSvg(svg: string, original: string, next: string) {
  const source = normalizeHex(original)?.slice(0, 7);
  const replacement = normalizeHex(next)?.slice(0, 7);
  if (!source || !replacement) return svg;
  return svg.replace(/#[\da-f]{3,8}\b/gi, raw => {
    const normalized = normalizeHex(raw);
    if (!normalized || normalized.slice(0, 7) !== source) return raw;
    return `${replacement}${normalized.length === 9 ? normalized.slice(7) : ""}`;
  });
}

export type MonochromeAppearance = {
  mode: "solid" | "linear" | "radial";
  color: string;
  endColor: string;
  angle: number;
  alpha?: number;
  endAlpha?: number;
  startOffset?: number;
  endOffset?: number;
};

export function applyMonochromeAppearance(svg: string, original: string, appearance: MonochromeAppearance) {
  if (appearance.mode === "solid") return recolorMonochromeSvg(svg, original, appearance.color);
  const source = normalizeHex(original)?.slice(0, 7);
  if (!source || !normalizeHex(appearance.color) || !normalizeHex(appearance.endColor)) return svg;
  const clamp = (value: number | undefined, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value! : fallback));
  const start = clamp(appearance.startOffset, 0, 0, 100);
  const end = clamp(appearance.endOffset, 100, start, 100);
  const startAlpha = clamp(appearance.alpha, 1, 0, 1);
  const endAlpha = clamp(appearance.endAlpha, 1, 0, 1);
  const stops = `<stop offset="${start / 100}" stop-color="${appearance.color}" stop-opacity="${startAlpha}"/><stop offset="${end / 100}" stop-color="${appearance.endColor}" stop-opacity="${endAlpha}"/>`;
  const gradient = appearance.mode === "radial"
    ? `<radialGradient id="generated-icon-paint">${stops}</radialGradient>`
    : `<linearGradient id="generated-icon-paint" x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform="rotate(${clamp(appearance.angle, 90, 0, 359)} .5 .5)">${stops}</linearGradient>`;
  const painted = svg.replace(/#[\da-f]{3,8}\b/gi, raw => normalizeHex(raw)?.slice(0, 7) === source ? "url(#generated-icon-paint)" : raw);
  return painted.replace(/<svg\b([^>]*)>/i, `<svg$1><defs>${gradient}</defs>`);
}
