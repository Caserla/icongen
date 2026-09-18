export type PreviewSvgColors = {
  solid: string;
  alpha?: number;
  gradient?: { start: string; end: string; mode: "linear" | "radial" };
};

const normalizeHex = (value: string) => {
  if (/^#[\da-f]{8}$/i.test(value)) return value.slice(0, 7).toUpperCase();
  if (/^#[\da-f]{6}$/i.test(value)) return value.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(value)) return `#${[...value.slice(1)].map(digit => digit.repeat(2)).join("")}`.toUpperCase();
  return null;
};

const attribute = (tag: string, name: string) => tag.match(new RegExp(`(?:\\s)${name}="([^"]+)"`, "i"))?.[1];

export function previewSvgColors(svg: string, dark = false): PreviewSvgColors | null {
  const inkValues = [...svg.matchAll(/--ink:\s*(#[\da-f]{3,6})/gi)].map(match => match[1]);
  const ink = normalizeHex(dark ? inkValues.at(-1) ?? "" : inkValues[0] ?? "");
  const gradients = new Map<string, PreviewSvgColors["gradient"]>();
  for (const match of svg.matchAll(/<(linearGradient|radialGradient)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const id = attribute(match[2], "id");
    const stops = [...match[3].matchAll(/<stop\b[^>]*>/gi)]
      .map(stop => normalizeHex(attribute(stop[0], "stop-color") ?? ""))
      .filter((color): color is string => color !== null);
    if (id && stops.length >= 2) gradients.set(id, {
      start: stops[0], end: stops.at(-1)!, mode: match[1].toLowerCase() === "radialgradient" ? "radial" : "linear",
    });
  }

  const artwork = svg.replace(/<defs\b[^>]*>[\s\S]*?<\/defs>/gi, "");
  let solid: string | null = null;
  let alpha: number | undefined;
  let gradient: PreviewSvgColors["gradient"];
  for (const match of artwork.matchAll(/<(?:path|circle|ellipse|rect|polygon|polyline|line)\b[^>]*>/gi)) {
    for (const paint of [attribute(match[0], "fill"), attribute(match[0], "stroke")]) {
      if (!paint || paint === "none") continue;
      const referenced = paint.match(/^url\(#([\w-]+)\)$/)?.[1];
      const usedGradient = referenced ? gradients.get(referenced) : undefined;
      if (usedGradient) {
        gradient ??= usedGradient;
        solid ??= usedGradient.start;
      } else {
        const color = paint === "var(--ink)" ? ink : normalizeHex(paint);
        if (!solid && color) {
          solid = color;
          if (/^#[\da-f]{8}$/i.test(paint)) alpha = Math.round(Number.parseInt(paint.slice(7), 16) / 255 * 100);
        }
      }
    }
  }
  return solid ? { solid, ...(alpha === undefined ? {} : { alpha }), ...(gradient ? { gradient } : {}) } : null;
}
