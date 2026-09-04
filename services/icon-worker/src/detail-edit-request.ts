import type { ImageProvider } from "@icongen/backend-core";
import type { IconStyle } from "@icongen/shared";

type GenerateInput = Parameters<ImageProvider["generate"]>[0];

const REMOVE_BACKGROUND_PATTERNS = [
  /(?:去掉|移除|删除|清除|取消)(?:图标|图片|画布)?背景/u,
  /背景(?:改为|变成|设为|设置为)?(?:透明|无)/u,
  /(?:remove|delete|erase|clear)\s+(?:the\s+)?(?:icon\s+|image\s+)?background\b/i,
  /\b(?:make|set)\s+(?:the\s+)?background\s+transparent\b/i,
  /\btransparent\s+background\b/i,
];

export function requestsTransparentBackground(instruction: string) {
  return REMOVE_BACKGROUND_PATTERNS.some((pattern) => pattern.test(instruction));
}

export function createDetailEditRequest(input: {
  compiledPrompt: string;
  instruction: string;
  stylePreset: IconStyle["preset"];
  outputBackground?: "transparent" | "opaque";
  transparencyStrategy?: "native-alpha" | "chroma-key";
  chromaColor?: { red: number; green: number; blue: number };
  sourceBytes: Uint8Array;
}): GenerateInput {
  const edgeContract =
    input.outputBackground === "transparent"
      ? input.transparencyStrategy === "chroma-key"
        ? "Preserve the exact temporary key color specified below across every pixel outside the artwork. Keep a crisp hard separation with no key-color spill, reflection, glow or antialiasing contamination on the artwork. The production worker converts that temporary region to real alpha."
        : "Return a native RGBA PNG. Keep every pixel outside the complete icon artwork genuinely transparent with alpha 0, including all four corners. Preserve clean antialiased artwork edges without any white, black, colored or checkerboard matte."
      : "Keep the existing background continuous and full-bleed through every canvas edge and corner. Do not add a white or near-white border, matte, inset frame, outline, halo, fringe, padding band or unpainted margin around the subject, background shape or canvas perimeter.";
  const styleContract = `The original icon uses the ${input.stylePreset} style. Treat that style identity and the supplied source image's actual visual language as immutable. Any element added, replaced, extended or exposed by this edit must look native to the same icon: match its shape language, palette, line weight, edge treatment, material, texture, lighting, depth, perspective and detail density. Never paste in an element from a different visual style, and never let a newly added element look photorealistic, generic or separately rendered unless the original icon already does.`;

  const requestedChange = input.outputBackground === "transparent"
    ? `${input.instruction}\n\nUSER TRANSPARENCY INTENT — OVERRIDING OUTPUT REQUIREMENT\nThe requested removal of the background means real pixel transparency, not a visual imitation. Remove the complete existing canvas/background layer while preserving the foreground icon artwork. Return native RGBA alpha: pixels outside the foreground artwork must have alpha 0. Never draw a checkerboard, white/black/gray/color fill, gradient, matte, card, tile, frame, border, halo or shadow as a replacement background.`
    : input.instruction;

  return {
    mode: "detail-edit",
    prompt: `DETAIL EDIT MODE\nThe supplied source icon is the only editable artwork and the authoritative reference for subject identity, composition and visual style. Apply only this requested change: ${requestedChange}\nPreserve the subject identity, composition, optical size, stroke width, palette and every unspecified foreground detail. Preserve the prior background mode unless the requested change explicitly changes or removes the background; in that case the user's requested background mode overrides the prior one. Return exactly one square production icon. Do not redesign, reinterpret or regenerate the icon from scratch.\n\nORIGINAL STYLE CONTINUITY — HARD REQUIREMENT\n${styleContract}\n\nEDGE INTEGRITY — HARD REQUIREMENT\n${edgeContract}\nThe edit must not introduce any new border treatment that is absent from the supplied source icon. Inspect all four edges and corners before returning the image.\n\nIMMUTABLE FOREGROUND STYLE CONTRACT\nUse the following original contract only for foreground identity and visual-style continuity. Any background instruction inside it is superseded by the explicit user request and output requirement above.\n${input.compiledPrompt}`,
    background: input.outputBackground,
    transparencyStrategy: input.transparencyStrategy,
    chromaColor: input.chromaColor,
    sourceImage: {
      bytes: input.sourceBytes,
      mimeType: "image/png",
      filename: "source-icon.png",
    },
  };
}
