import type { ImageProvider } from "@icongen/backend-core";
import OpenAI from "openai";

export class OpenAIImageProvider implements ImageProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate({ prompt }: { prompt: string }) {
    const response = await this.client.images.generate({
      model: this.model,
      prompt,
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
