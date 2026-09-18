import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

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
  const cacheKey = `${root}:${styleId}`;
  if (boardCache.has(cacheKey)) return boardCache.get(cacheKey) ?? null;
  const boardDirectory = path.join(root, "outputs/ui-style-reference-boards-2026-09-15");
  if (existsSync(boardDirectory)) {
    const suffix = `-${styleId}-atlas-reference-v1.png`;
    const file = readdirSync(boardDirectory).find(name => name.endsWith(suffix));
    if (file) {
      const value = `data:image/png;base64,${readFileSync(path.join(boardDirectory, file)).toString("base64")}`;
      boardCache.set(cacheKey, value);
      return value;
    }
  }

  const fallback = path.join(root, "apps/web/public/generation/style-subcategories", `${styleId}.svg`);
  const value = existsSync(fallback) ? `data:image/svg+xml;base64,${readFileSync(fallback).toString("base64")}` : null;
  boardCache.set(cacheKey, value);
  return value;
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
