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
    const response = await this.client.images.generate({
      model: this.model,
      prompt,
      quality: this.quality,
      size: this.size,
      background,
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
