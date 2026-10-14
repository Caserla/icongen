type Lab = { l: number; a: number; b: number };
type Lch = { l: number; c: number; h: number };
const wrap = (h: number) => (h % 360 + 360) % 360;
const radians = (h: number) => h * Math.PI / 180;
const linear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const srgb = (v: number) => v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
const channels = (hex: string) => [1, 3, 5].map(i => linear(parseInt(hex.slice(i, i + 2), 16) / 255));

export function toOklab(hex: string): Lab {
  const [r, g, b] = channels(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s };
}

export function perceptualDistance(a: string, b: string) {
  const x = toOklab(a), y = toOklab(b);
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}

export function toLch(hex: string): Lch {
  const { l, a, b } = toOklab(hex);
  return { l, c: Math.hypot(a, b), h: wrap(Math.atan2(b, a) * 180 / Math.PI) };
}

function rgb({ l, c, h }: Lch) {
  const a = c * Math.cos(radians(h)), b = c * Math.sin(radians(h));
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z, -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z, -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z];
}

/** Chroma compression preserves hue/lightness; channel clipping would not. */
export function oklchHex(value: Lch) {
  let c = value.c, result = rgb(value);
  for (let i = 0; i < 60 && result.some(v => v < -0.000001 || v > 1.000001); i++) {
    c *= 0.92;
    result = rgb({ ...value, c });
  }
  return `#${result.map(v => Math.round(Math.max(0, Math.min(1, srgb(v))) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => { const [r, g, b] = channels(hex); return r * 0.2126 + g * 0.7152 + b * 0.0722; };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
