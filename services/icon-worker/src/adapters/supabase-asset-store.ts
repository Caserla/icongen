import type { AssetStore } from "@icongen/backend-core";
import type { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseAssetStore implements AssetStore {
  constructor(private readonly client: SupabaseClient, private readonly bucket: string) {}

  async put(input: { jobId: string; slot: number; bytes: Uint8Array; mimeType: string }) {
    const objectPath = `${input.jobId}/result-${input.slot}.png`;
    const { error } = await this.client.storage.from(this.bucket).upload(objectPath, input.bytes, {
      contentType: input.mimeType,
      upsert: true,
    });
    if (error) throw new Error(`Failed to store generated icon: ${error.message}`);
    return { bucket: this.bucket, objectPath };
  }
}
