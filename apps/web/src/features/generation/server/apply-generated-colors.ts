type Gradient = { mode?: unknown; color?: unknown; endColor?: unknown };

function lockedGradient(colors: unknown) {
  if (!colors || typeof colors !== "object") return null;
  const value = colors as { locked?: unknown; default?: unknown };
  if (value.locked !== true || !value.default || typeof value.default !== "object") return null;
  const selected = value.default as Gradient;
  if ((selected.mode !== "linear" && selected.mode !== "radial")
    || typeof selected.color !== "string" || typeof selected.endColor !== "string"
    || !/^#[0-9a-f]{6}$/i.test(selected.color) || !/^#[0-9a-f]{6}$/i.test(selected.endColor)) return null;
  return { mode: selected.mode, start: selected.color.toUpperCase(), end: selected.endColor.toUpperCase() } as const;
}

export function applyLockedGradient(svg: string, colors: unknown, idPrefix: string) {
  const gradient = lockedGradient(colors);
  if (!gradient) return svg;
  const id = `${idPrefix}-locked-gradient`;
  const definition = gradient.mode === "radial"
    ? `<radialGradient id="${id}" cx="30%" cy="25%" r="80%"><stop offset="0" stop-color="${gradient.start}"/><stop offset="1" stop-color="${gradient.end}"/></radialGradient>`
    : `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gradient.start}"/><stop offset="1" stop-color="${gradient.end}"/></linearGradient>`;
  const painted = svg.replace(/\b(fill|stroke)\s*=\s*(["'])([^"']+)\2/gi, (match, attribute: string, quote: string, paint: string) => {
    const normalized = paint.trim().toLowerCase();
    if (normalized === "none" || normalized === "transparent" || normalized === "white" || normalized === "#fff" || normalized === "#ffffff") return match;
    return `${attribute}=${quote}url(#${id})${quote}`;
  });
  return painted.replace(/(<svg\b[^>]*>)/i, `$1<defs>${definition}</defs>`);
}

export function assertStyleConformance(svg: string, styleId: string) {
  const strokedElements = [...svg.matchAll(/<(?:path|rect|circle|ellipse|line|polyline|polygon)\b[^>]*\bstroke=["'](?!none["']|transparent["'])[^"']+["'][^>]*>/gi)];
  const strokeWidths = strokedElements.map(match => {
    const width = match[0].match(/\bstroke-width=["']([0-9]*\.?[0-9]+)["']/i);
    return width ? Number(width[1]) : 1;
  }).filter(width => width > 0);
  const distinctStrokeWidths = [...new Set(strokeWidths.map(width => Math.round(width * 100) / 100))];
  if (distinctStrokeWidths.length > 1) throw new Error(`Inconsistent stroke widths: ${distinctStrokeWidths.join(", ")}`);
  if (styleId === "radial" && !/<radialGradient\b/i.test(svg)) throw new Error("Radial style requires a radialGradient paint");
  if (["gradient-outline", "gradient-fill", "multi-stop", "dual-neon"].includes(styleId) && !/<linearGradient\b/i.test(svg)) {
    throw new Error("Selected style requires a linearGradient paint");
  }
}
