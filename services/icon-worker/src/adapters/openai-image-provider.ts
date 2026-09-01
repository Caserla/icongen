import type { ImageProvider } from "@icongen/backend-core";
import OpenAI, { toFile } from "openai";

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

  async generate({ prompt, background = "auto", referenceImage }: Parameters<ImageProvider["generate"]>[0]) {
    // Some OpenAI-compatible gateways reject the native
    // `background: "transparent"` request field even though the image model can
    // still return an RGBA PNG when transparency is specified in the prompt.
    // Use prompt-driven transparency for compatibility; backend-core verifies
    // the returned alpha channel and retries when the provider paints a
    // background instead.
    const wantsTransparency = background === "transparent";
    const effectivePrompt = wantsTransparency
      ? referenceImage
        ? `${prompt}\n\nCHROMA KEY OUTPUT REQUIREMENT\nBecause this image-edit endpoint cannot return native transparency, render every background pixel as one perfectly uniform pure chroma green #00FF00. Use no green spill, shadow, glow, fog, texture, gradient, checkerboard, border, or secondary backdrop outside the subject. Never use #00FF00 inside the subject. The production worker will convert only this chroma background to real alpha.`
        : `${prompt}\n\nTRANSPARENT OUTPUT REQUIREMENT\nReturn a native RGBA PNG with a real alpha channel. Every pixel outside the icon artwork must be fully transparent. Do not paint white, black, gray, colored, gradient, photographic, or checkerboard canvas pixels. Do not simulate transparency. Do not add an outer tile, card, frame, border, halo, glow, fog, or backdrop.`
      : prompt;
    const request = {
      model: this.model,
      prompt: referenceImage
        ? `${effectivePrompt}\n\nSTYLE REFERENCE IMAGE\nUse the attached image as the authoritative visual-style reference for palette, shape language, edge treatment, material, depth, and detail density. Recreate those visual rules as closely as possible on a blank square canvas. The attached image is not an editable source asset: do not return, crop, extract, preserve, or reconstruct the reference board, its grid, canvas layout, text, symbols, subjects, or composition. Render exactly one newly composed requested subject and obey the requested background type, background shape, and corner-radius contract.`
        : effectivePrompt,
      quality: this.quality,
      size: this.size,
      background: wantsTransparency ? "auto" as const : background,
      output_format: "png" as const,
    };
    const response = referenceImage
      ? await this.client.images.edit({
          ...request,
          image: await toFile(Buffer.from(referenceImage.bytes), referenceImage.filename, {
            type: referenceImage.mimeType,
          }),
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
