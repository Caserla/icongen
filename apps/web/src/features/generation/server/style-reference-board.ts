import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { isLibraryGenerationStyle } from "../library-generation-styles";

const boardCache = new Map<string, string | null>();
const contractCache = new Map<string, string | null>();

function repositoryRoot() {
  const configured = process.env.ICON_REPOSITORY_ROOT;
  const candidates = [configured, process.cwd(), path.resolve(process.cwd(), "../..")].filter((value): value is string => Boolean(value));
  return candidates.find(candidate => existsSync(path.join(candidate, "docs/design/svg-style-prompts-v2.json"))) ?? process.cwd();
}

/** Visual style evidence used by the SVG model. The legacy atlas predates broken-outline. */
export function styleReferenceBoardDataUrl(styleId: string) {
  const root = repositoryRoot();
  const selected = selectedBoard(root, styleId);
  if (!selected) return null;
  const cacheKey = `${selected}:${statSync(selected).mtimeMs}`;
  if (boardCache.has(cacheKey)) return boardCache.get(cacheKey) ?? null;
  const value = `data:image/png;base64,${readFileSync(selected).toString("base64")}`;
  boardCache.set(cacheKey, value);
  return value;
}

function selectedBoard(root: string, styleId: string) {
  const boardDirectory = path.join(root, "outputs/ui-style-reference-boards-2026-09-15");
  if (existsSync(boardDirectory)) {
    const manifestPath = path.join(boardDirectory, "accepted-fill-versions.json");
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { styles?: Record<string, string> };
        const entry = Object.entries(manifest.styles ?? {}).find(([key]) => key.replace(/^\d+-/, "") === styleId);
        const file = entry?.[1];
        if (file && path.basename(file) === file && file.endsWith(".png") && existsSync(path.join(boardDirectory, file))) return path.join(boardDirectory, file);
      } catch { /* A missing/corrupt optional manifest must not fail generation. */ }
    }
    const suffix = `-${styleId}-atlas-reference-v1.png`;
    const file = readdirSync(boardDirectory).sort().find(name => name.endsWith(suffix));
    if (file) return path.join(boardDirectory, file);
  }
  return null;
}

type GenerationReference = { dataUrl: string; source: string; sha256: string };
const libraryCache = new Map<string, Promise<GenerationReference | null>>();
const digest = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
const focusedReferenceStyles = new Set(["isometric", "doodle", "pixel-outline", "pixel-solid", "pixel-color", "outline-duotone"]);

async function focusedReference(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  if (metadata.width !== 1536 || metadata.height !== 1024) return null;
  const cell = 256;
  const sampleIndices = [0, 3, 8, 13]; // cards, book, calendar, heart: no requested search/settings subject.
  const layers = await Promise.all(sampleIndices.map(async (index, position) => ({
    input: await sharp(buffer).extract({ left: (index % 6) * cell, top: Math.floor(index / 6) * cell, width: cell, height: cell }).png().toBuffer(),
    left: (position % 2) * cell, top: Math.floor(position / 2) * cell,
  })));
  return sharp({ create: { width: 512, height: 512, channels: 4, background: "#FFFFFF" } }).composite(layers).png().toBuffer();
}

/** Real library evidence for Linear/Bold/Broken; named accepted boards for other styles. */
export async function generationStyleReference(styleId: string): Promise<GenerationReference | null> {
  const root = repositoryRoot();
  if (isLibraryGenerationStyle(styleId) || ["regular", "pure-solid", "state-pair", "broken-outline"].includes(styleId)) {
    const styles = isLibraryGenerationStyle(styleId) ? [styleId] : styleId === "state-pair" ? ["linear", "bold"] : [styleId === "regular" ? "linear" : styleId === "broken-outline" ? "broken" : "bold"];
    const files = styles.flatMap(style => ["home-sample-1", "search-sample-1", "files-sample-1", "essential-sample-2"].map(id => path.join(root, "apps/web/public/library/samples", id, `${style}.svg`)));
    if (files.every(existsSync)) {
      const buffers = files.map(file => readFileSync(file));
      const hash = digest(Buffer.concat(buffers));
      const cacheKey = `${styleId}:${hash}`;
      if (!libraryCache.has(cacheKey)) libraryCache.set(cacheKey, (async () => {
        const layers = await Promise.all(buffers.map(async (buffer, index) => ({
          input: await sharp(Buffer.from(buffer.toString().replace(/currentColor/g, "#34383D"))).resize(96, 96).png().toBuffer(),
          left: (index % 4) * 128 + 16, top: Math.floor(index / 4) * 128 + 16,
        })));
        const png = await sharp({ create: { width: 512, height: styles.length * 128, channels: 4, background: "#FAFAFA" } }).composite(layers).png().toBuffer();
        return { dataUrl: `data:image/png;base64,${png.toString("base64")}`, source: `library-${styles.join("-")}:${files.map(file => path.relative(root, file)).join(",")}`, sha256: digest(png) };
      })().catch(() => null));
      const library = await libraryCache.get(cacheKey);
      if (library) return library;
    }
  }
  const file = selectedBoard(root, styleId);
  if (!file) return null; // Never send an unsupported SVG data URL to a vision endpoint.
  const buffer = readFileSync(file);
  // Promote enlarged evidence only for the reviewed candidates; keep other
  // accepted boards unchanged until their own side-by-side visual review.
  if (focusedReferenceStyles.has(styleId)) {
    const focused = await focusedReference(buffer);
    if (focused) return { dataUrl: `data:image/png;base64,${focused.toString("base64")}`, source: `focused-4:${path.basename(file)}`, sha256: digest(focused) };
  }
  return { dataUrl: styleReferenceBoardDataUrl(styleId)!, source: path.basename(file), sha256: digest(buffer) };
}

/** Precomputed instructions stored beside the reviewed visual board. */
export function styleReferenceBoardContract(styleId: string) {
  // The legacy illustrative metadata describes how to compose an atlas
  // (canvas size, grid and subjects), not how to draw one production icon.
  if (styleId === "illustrative") return null;
  const root = repositoryRoot();
  const cacheKey = `${root}:${styleId}`;
  if (contractCache.has(cacheKey)) return contractCache.get(cacheKey) ?? null;
  const boardDirectory = path.join(root, "outputs/ui-style-reference-boards-2026-09-15");
  if (!existsSync(boardDirectory)) { contractCache.set(cacheKey, null); return null; }
  const suffix = `-${styleId}-atlas-reference-v1.json`;
  const file = readdirSync(boardDirectory).find(name => name.endsWith(suffix));
  if (!file) { contractCache.set(cacheKey, null); return null; }
  try {
    const parsed = JSON.parse(readFileSync(path.join(boardDirectory, file), "utf8")) as { prompt?: unknown };
    const value = typeof parsed.prompt === "string" && parsed.prompt.trim() ? parsed.prompt.trim() : null;
    contractCache.set(cacheKey, value);
    return value;
  } catch {
    contractCache.set(cacheKey, null);
    return null;
  }
}
