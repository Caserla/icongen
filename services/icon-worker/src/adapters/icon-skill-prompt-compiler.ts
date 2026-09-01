import type { PromptCompiler } from "@icongen/backend-core";
import { compileIconPrompt, ICON_SKILL_NAME, ICON_SKILL_VERSION } from "@icongen/icon-skill";
import { readFileSync } from "node:fs";

const referenceImageCache = new Map<string, Uint8Array>();

function loadReferenceImage(assetUrl: string) {
  const cached = referenceImageCache.get(assetUrl);
  if (cached) return cached;
  const bytes = readFileSync(new URL(assetUrl));
  referenceImageCache.set(assetUrl, bytes);
  return bytes;
}

export const iconSkillPromptCompiler: PromptCompiler = {
  name: ICON_SKILL_NAME,
  version: ICON_SKILL_VERSION,
  compile(input) {
    const compiled = compileIconPrompt(input);
    if (!compiled.referenceImageAssetUrl) return compiled;
    const assetUrl = compiled.referenceImageAssetUrl;
    return {
      ...compiled,
      referenceImage: {
        bytes: loadReferenceImage(assetUrl),
        mimeType: "image/png" as const,
        filename: new URL(assetUrl).pathname.split("/").at(-1) ?? "style-reference.png",
      },
    };
  },
};
