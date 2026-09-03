import type { ImageProvider } from "@icongen/backend-core";

type GenerateInput = Parameters<ImageProvider["generate"]>[0];

export function createDetailEditRequest(input: {
  compiledPrompt: string;
  instruction: string;
  outputBackground?: "transparent" | "opaque";
  transparencyStrategy?: "native-alpha" | "chroma-key";
  chromaColor?: { red: number; green: number; blue: number };
  sourceBytes: Uint8Array;
}): GenerateInput {
  const edgeContract = input.outputBackground === "transparent"
    ? input.transparencyStrategy === "chroma-key"
      ? "Preserve the exact temporary key color specified below across every pixel outside the artwork. Keep a crisp hard separation with no key-color spill, reflection, glow or antialiasing contamination on the artwork. The production worker converts that temporary region to real alpha."
      : "Return a native RGBA PNG. Keep every pixel outside the complete icon artwork genuinely transparent with alpha 0, including all four corners. Preserve clean antialiased artwork edges without any white, black, colored or checkerboard matte."
    : "Keep the existing background continuous and full-bleed through every canvas edge and corner. Do not add a white or near-white border, matte, inset frame, outline, halo, fringe, padding band or unpainted margin around the subject, background shape or canvas perimeter.";

  return {
    mode: "detail-edit",
    prompt: `DETAIL EDIT MODE\nThe supplied source icon is the only editable artwork and the authoritative reference for subject identity, composition and visual style. Apply only this requested change: ${input.instruction}\nPreserve the subject identity, composition, canvas, optical size, stroke width, palette, background mode, background shape, corner radius, transparency and every unspecified detail. Return exactly one square production icon. Do not redesign, reinterpret or regenerate the icon from scratch.\n\nEDGE INTEGRITY — HARD REQUIREMENT\n${edgeContract}\nThe edit must not introduce any new border treatment that is absent from the supplied source icon. Inspect all four edges and corners before returning the image.\n\nIMMUTABLE STYLE AND OUTPUT CONTRACT\n${input.compiledPrompt}`,
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
