import type { AssetStore } from "@icongen/backend-core";
import type { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseAssetStore implements AssetStore {
  constructor(private readonly client: SupabaseClient, private readonly bucket: string) {}

  async put(input: { jobId: string; subjectId: string; variantId: string; slot: 1 | 2 | 3; assetRole: "source" | "preview" | "output"; format: "png" | "svg"; size: number; bytes: Uint8Array; mimeType: string }) {
    const filename = input.format === "svg" ? "output.svg" : input.assetRole === "output" ? `${input.size}.png` : `${input.assetRole}.png`;
    const objectPath = `${input.jobId}/${input.subjectId}/variant-${input.slot}/${filename}`;
    const { error } = await this.client.storage.from(this.bucket).upload(objectPath, input.bytes, {
      contentType: input.mimeType,
      upsert: true,
    });
    if (error) throw new Error(`Failed to store generated icon: ${error.message}`);
    return { bucket: this.bucket, objectPath };
  }
}
