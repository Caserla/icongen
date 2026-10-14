import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import catalog from "@/features/library/catalog.json";
import { isLibraryGenerationStyle } from "../library-generation-styles";
import { validateGeneratedSvg } from "./validate-generated-svg";

export const constructionFamilies = ["enclosure", "radial", "elongated", "organic", "layered", "symbol"] as const;
const donors: Record<typeof constructionFamilies[number], string[]> = {
  enclosure: ["security-sample-1", "video-audio-image-sample-2"],
  radial: ["weather-sample-3", "nature-sample-3"],
  elongated: ["tools-sample-1", "stationery-sample-2"],
  organic: ["nature-sample-1", "animals-sample-2"],
  layered: ["school-learning-sample-1", "delivery-sample-1"],
  symbol: ["security-sample-2", "location-sample-1"],
};
const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** References teach a construction family, never retrieve the requested object as an answer. */
export function selectConstructionDonor(family: string | undefined, subject: { name: string; description?: string }) {
  const names = [clean(subject.name), clean(subject.description ?? "")].filter(Boolean);
  return (donors[family as keyof typeof donors] ?? []).map(id => catalog.find(item => item.id === id)).find(entry => entry && ![entry.nameZh, entry.nameEn].some(label => {
    const key = clean(label);
    return names.some(name => /[\u3400-\u9fff]/.test(key) ? name.includes(key) || key.includes(name) : (` ${name} `).includes(` ${key} `));
  })) ?? null;
}

export async function libraryConstructionReference(family: string | undefined, subject: { name: string; description?: string }, styles: string[]) {
  const entry = selectConstructionDonor(family, subject);
  if (!entry || styles.some(style => !isLibraryGenerationStyle(style))) return null;
  const roots = [process.env.ICON_REPOSITORY_ROOT && path.join(process.env.ICON_REPOSITORY_ROOT, "apps/web/public"), path.resolve(process.cwd(), "public"), path.resolve(process.cwd(), "apps/web/public")].filter((root): root is string => Boolean(root));
  for (const root of roots) {
    try {
      const examples = await Promise.all(styles.map(async style => {
        // Outline is compiled later; teach editable centerlines, not a huge hand-expanded contour.
        const sourceStyle = style === "outline" ? "linear" : style;
        const svg = validateGeneratedSvg(await readFile(path.join(root, "library/samples", entry.id, `${sourceStyle}.svg`), "utf8"));
        const hash = createHash("sha256").update(svg).digest("hex");
        const layers = await Promise.all([24, 48, 160].map(async (size, i) => ({ input: await sharp(Buffer.from(svg.replace(/currentColor/g, "#343A40"))).resize(size, size).png().toBuffer(), left: [12, 56, 132][i], top: Math.floor((184 - size) / 2) })));
        const png = await sharp({ create: { width: 304, height: 184, channels: 4, background: "#FFFFFF" } }).composite(layers).png().toBuffer();
        return { style, sourceStyle, sha256: hash, dataUrl: `data:image/png;base64,${png.toString("base64")}`,
          // Small readable geometry teaches actual joins; huge expanded outlines do not.
          geometryExample: svg.length <= 6500 ? svg : undefined };
      }));
      return { family, id: entry.id, name: entry.nameZh, catalogStatus: entry.status, examples };
    } catch { /* Optional evidence must not prevent generation on a partial deployment. */ }
  }
  return null;
}
