import type { ImageProvider } from "@icongen/backend-core";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { chromaHex } from "../select-chroma-key";

type ProviderPromptInput = Parameters<ImageProvider["generate"]>[0] & {
  wantsTransparency: boolean;
};

const GENERATION_TRANSPARENCY_REQUIREMENT = [
  "TRANSPARENT OUTPUT",
  "Return one PNG with a real transparent background. Keep empty space outside and through the artwork transparent, while preserving all solid subject surfaces, dark interiors, and self-shading.",
  "Retain the requested style's outlines, light effects, edge treatment, and intentional translucent materials. Deliver actual image transparency, without a painted backdrop or preview pattern.",
].join("\n");

export function resolveTransparencyStrategy({
  mode,
  sourceImage,
  wantsTransparency,
  transparencyStrategy,
}: Pick<ProviderPromptInput, "mode" | "sourceImage" | "wantsTransparency" | "transparencyStrategy">) {
  if (mode === "generation" && wantsTransparency) return "native-alpha";
  if (transparencyStrategy) return transparencyStrategy;
  return wantsTransparency && mode === "detail-edit" && sourceImage
    ? "chroma-key"
    : "native-alpha";
}

export function buildOpenAIImagePrompt({
  mode,
  prompt,
  sourceImage,
  referenceImage,
  wantsTransparency,
  transparencyStrategy,
  chromaColor,
}: ProviderPromptInput) {
  const keyHex = chromaHex(chromaColor ?? { red: 0, green: 255, blue: 0 });
  const transparencyPrompt = wantsTransparency && mode !== "generation"
    ? transparencyStrategy === "chroma-key"
      ? `${prompt}\n\nCHROMA KEY FALLBACK REQUIREMENT\nRender every pixel outside the complete icon artwork as one perfectly uniform pure ${keyHex}. Do not use ${keyHex} inside the artwork. Prevent key-color spill, reflection, glow, fog, texture, gradient, checkerboard, border or secondary backdrop. The production worker converts this region to real alpha.`
      : `${prompt}\n\nTRANSPARENT OUTPUT REQUIREMENT\nReturn a native RGBA PNG with a real alpha channel. Every pixel outside the icon artwork must be fully transparent. Do not paint white, black, gray, colored, gradient, photographic, or checkerboard canvas pixels. Do not simulate transparency. Do not add an outer tile, card, frame, border, halo, glow, fog, or backdrop.`
    : prompt;

  if (mode === "generation") {
    // New images use the text-only generations endpoint. Style rules already
    // live in the compiled prompt; do not refer to an unattached source/board.
    // Keep the output contract last, after style context and retry corrections.
    return `${prompt}${wantsTransparency ? `\n\n${GENERATION_TRANSPARENCY_REQUIREMENT}` : ""}`;
  }

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
    .flatten({
      background: {
        r: chromaColor.red,
        g: chromaColor.green,
        b: chromaColor.blue,
      },
    })
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
    timeout = 240_000,
    maxRetries = 0,
  ) {
    this.client = new OpenAI({ apiKey, baseURL, timeout, maxRetries });
  }

  async generate({
    mode,
    prompt,
    background = "auto",
    sourceImage,
    referenceImage,
    transparencyStrategy,
    chromaColor,
  }: Parameters<ImageProvider["generate"]>[0]) {
    if (mode === "detail-edit" && !sourceImage) {
      throw new Error("Detail editing requires a source image");
    }
    // This gateway rejects the native `background: "transparent"` field. Keep
    // the requested output in the prompt and validate the actual returned
    // pixels; a prompt alone is not proof that the upstream supports alpha.
    const wantsTransparency = background === "transparent";
    // Only actual detail editing can use a working matte. Generation uses
    // neither an editable reference board nor an intermediate chroma canvas.
    const effectiveTransparencyStrategy = resolveTransparencyStrategy({
      mode,
      sourceImage,
      wantsTransparency,
      transparencyStrategy,
    });
    const request = {
      model: this.model,
      prompt: buildOpenAIImagePrompt({
        mode,
        prompt,
        background,
        sourceImage,
        referenceImage,
        wantsTransparency,
        transparencyStrategy: effectiveTransparencyStrategy,
        chromaColor,
      }),
      quality: this.quality,
      size: this.size,
      // The compatible upstream may reject its native transparency parameter.
      // Transparent output is therefore prompt-driven and validated after the
      // response; only opaque/auto requests send this field.
      ...(!wantsTransparency ? { background } : {}),
      output_format: "png" as const,
    };
    // Route by the requested operation, never by the presence of a reference.
    // Sub2API maps /images/generations to action: generate and /images/edits
    // to action: edit. References remain available to local quality checks,
    // but are not uploaded for a new generation (including retries).
    const editImages = mode === "detail-edit"
      ? await Promise.all(
          [sourceImage, referenceImage]
            .filter((image): image is NonNullable<typeof image> => Boolean(image))
            .map(async (image) =>
              toFile(
                Buffer.from(
                  await prepareTransparentEditInput(
                    image,
                    wantsTransparency,
                    effectiveTransparencyStrategy,
                    chromaColor,
                  ),
                ),
                image.filename,
                { type: image.mimeType },
              ),
            ),
        )
      : [];
    const response =
      mode === "detail-edit"
        ? await this.client.images.edit({
            ...request,
            image: editImages.length === 1 ? editImages[0] : editImages,
            input_fidelity: "high",
          })
        : await this.client.images.generate(request);
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded)
      throw new Error("OpenAI image response did not include b64_json data");

    return {
      bytes: Buffer.from(encoded, "base64"),
      mimeType: "image/png" as const,
      providerRequestId: response._request_id ?? undefined,
    };
  }
}
