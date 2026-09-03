import type { ImageProvider } from "@icongen/backend-core";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { chromaHex } from "../select-chroma-key";

type ProviderPromptInput = Parameters<ImageProvider["generate"]>[0] & {
  wantsTransparency: boolean;
};

export function buildOpenAIImagePrompt({ mode, prompt, sourceImage, referenceImage, wantsTransparency, transparencyStrategy, chromaColor }: ProviderPromptInput) {
  const keyHex = chromaHex(chromaColor ?? { red: 0, green: 255, blue: 0 });
  const transparencyPrompt = wantsTransparency
    ? transparencyStrategy === "chroma-key"
      ? `${prompt}\n\nCHROMA KEY FALLBACK REQUIREMENT\nRender every pixel outside the complete icon artwork as one perfectly uniform pure ${keyHex}. Do not use ${keyHex} inside the artwork. Prevent key-color spill, reflection, glow, fog, texture, gradient, checkerboard, border or secondary backdrop. The production worker converts this region to real alpha.`
      : `${prompt}\n\nTRANSPARENT OUTPUT REQUIREMENT\nReturn a native RGBA PNG with a real alpha channel. Every pixel outside the icon artwork must be fully transparent. Do not paint white, black, gray, colored, gradient, photographic, or checkerboard canvas pixels. Do not simulate transparency. Do not add an outer tile, card, frame, border, halo, glow, fog, or backdrop.`
    : prompt;

  if (mode === "generation" && referenceImage)
    return `${transparencyPrompt}\n\nSTYLE REFERENCE IMAGE\nUse the attached image as the authoritative visual-style reference for palette, shape language, edge treatment, material, depth, and detail density. Recreate those visual rules as closely as possible on a blank square canvas. The attached image is not an editable source asset: do not return, crop, extract, preserve, or reconstruct the reference board, its grid, canvas layout, text, symbols, subjects, or composition. Render exactly one newly composed requested subject and obey the requested background type, background shape, and corner-radius contract.`;

  if (mode === "detail-edit")
    return `${transparencyPrompt}\n\nSOURCE IMAGE ROLE\nThe supplied source image is the only editable artwork. Preserve its identity, composition, visual style, palette and geometry except for the explicitly requested detail. Do not start from a blank canvas and do not create a replacement icon.${referenceImage ? " A secondary image, if attached, is style-only context and must never replace or override the source image." : ""}`;

  return transparencyPrompt;
}

export async function prepareTransparentEditInput(
  image: NonNullable<Parameters<ImageProvider["generate"]>[0]["sourceImage"]>,
  wantsTransparency: boolean,
  strategy: "native-alpha" | "chroma-key" = "native-alpha",
  chromaColor = { red: 0, green: 255, blue: 0 },
) {
  if (!wantsTransparency || strategy === "native-alpha") return image.bytes;
  // Image edit gateways commonly flatten transparent source pixels against
  // black before inference, which then becomes a black fringe in the result.
  // Use the same pure-green working canvas requested from the model so the
  // existing chroma-to-alpha pass can remove the entire temporary backdrop.
  return sharp(image.bytes)
    .flatten({ background: { r: chromaColor.red, g: chromaColor.green, b: chromaColor.blue } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly quality: "low" | "medium" | "high" | "auto",
    private readonly size: "1024x1024" | "2048x2048",
    baseURL?: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generate({ mode, prompt, background = "auto", sourceImage, referenceImage, transparencyStrategy, chromaColor }: Parameters<ImageProvider["generate"]>[0]) {
    // Some OpenAI-compatible gateways reject the native
    // `background: "transparent"` request field even though the image model can
    // still return an RGBA PNG when transparency is specified in the prompt.
    // Use prompt-driven transparency for compatibility; backend-core verifies
    // the returned alpha channel and retries when the provider paints a
    // background instead.
    const wantsTransparency = background === "transparent";
    const effectiveTransparencyStrategy = transparencyStrategy ??
      (wantsTransparency && (sourceImage || referenceImage)
        ? "chroma-key"
        : "native-alpha");
    const request = {
      model: this.model,
      prompt: buildOpenAIImagePrompt({ mode, prompt, background, sourceImage, referenceImage, wantsTransparency, transparencyStrategy: effectiveTransparencyStrategy, chromaColor }),
      quality: this.quality,
      size: this.size,
      background: wantsTransparency && effectiveTransparencyStrategy === "native-alpha" ? "transparent" as const : wantsTransparency ? "auto" as const : background,
      output_format: "png" as const,
    };
    const editImages = await Promise.all(
      [sourceImage, referenceImage]
        .filter((image): image is NonNullable<typeof image> => Boolean(image))
        .map(async (image) =>
          toFile(
            Buffer.from(await prepareTransparentEditInput(image, wantsTransparency, effectiveTransparencyStrategy, chromaColor)),
            image.filename,
            { type: image.mimeType },
          ),
        ),
    );
    const response = editImages.length > 0
      ? await this.client.images.edit({
          ...request,
          image: editImages.length === 1 ? editImages[0] : editImages,
          input_fidelity: "high",
        })
      : await this.client.images.generate(request);
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("OpenAI image response did not include b64_json data");

    return {
      bytes: Buffer.from(encoded, "base64"),
      mimeType: "image/png" as const,
      providerRequestId: response._request_id ?? undefined,
    };
  }
}
