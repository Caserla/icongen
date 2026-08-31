import type { ImageProvider } from "@icongen/backend-core";
import OpenAI from "openai";

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

  async generate({ prompt, background = "auto" }: { prompt: string; background?: "transparent" | "opaque" | "auto" }) {
    // Some OpenAI-compatible gateways reject the native
    // `background: "transparent"` request field even though the image model can
    // still return an RGBA PNG when transparency is specified in the prompt.
    // Use prompt-driven transparency for compatibility; backend-core verifies
    // the returned alpha channel and retries when the provider paints a
    // background instead.
    const wantsTransparency = background === "transparent";
    const effectivePrompt = wantsTransparency
      ? `${prompt}\n\nTRANSPARENT OUTPUT REQUIREMENT\nReturn a native RGBA PNG with a real alpha channel. Every pixel outside the icon artwork must be fully transparent. Do not paint white, black, gray, colored, gradient, photographic, or checkerboard canvas pixels. Do not simulate transparency. Do not add an outer tile, card, frame, border, halo, glow, fog, or backdrop.`
      : prompt;
    const response = await this.client.images.generate({
      model: this.model,
      prompt: effectivePrompt,
      quality: this.quality,
      size: this.size,
      background: wantsTransparency ? "auto" : background,
      output_format: "png",
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("OpenAI image response did not include b64_json data");

    return {
      bytes: Buffer.from(encoded, "base64"),
      mimeType: "image/png" as const,
      providerRequestId: response._request_id ?? undefined,
    };
  }
}
