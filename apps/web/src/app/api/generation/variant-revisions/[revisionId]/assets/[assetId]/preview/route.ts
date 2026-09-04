import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  revisionId: z.string().uuid(),
  assetId: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ revisionId: string; assetId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiError("INVALID_PREVIEW_ASSET", "The preview asset ID is invalid.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const revision = await client.from("generation_variant_revisions")
      .select("id,variant_id,assets")
      .eq("id", parsed.data.revisionId)
      .eq("status", "completed")
      .maybeSingle();
    if (revision.error) throw revision.error;
    if (!revision.data) return apiError("PREVIEW_NOT_FOUND", "The preview image was not found.", 404);
    const variant = await client.from("generation_variants").select("subject_id")
      .eq("id", revision.data.variant_id).maybeSingle();
    if (variant.error) throw variant.error;
    const subject = variant.data
      ? await client.from("generation_subjects").select("job_id").eq("id", variant.data.subject_id).maybeSingle()
      : { data: null, error: null };
    if (subject.error) throw subject.error;
    const job = subject.data
      ? await client.from("generation_jobs").select("id").eq("id", subject.data.job_id).eq("user_id", user.id).maybeSingle()
      : { data: null, error: null };
    if (job.error) throw job.error;
    if (!job.data) return apiError("PREVIEW_NOT_FOUND", "The preview image was not found.", 404);
    const assets = Array.isArray(revision.data.assets) ? revision.data.assets : [];
    const asset = assets.find((item) => item && typeof item === "object" && "id" in item && String(item.id) === parsed.data.assetId) as { format?: unknown; storageBucket?: unknown; storagePath?: unknown } | undefined;
    if (!asset || asset.format !== "png" || typeof asset.storageBucket !== "string" || typeof asset.storagePath !== "string")
      return apiError("PREVIEW_NOT_FOUND", "The preview image was not found.", 404);
    const signed = await createAdminSupabaseClient().storage.from(asset.storageBucket).createSignedUrl(asset.storagePath, 300);
    if (signed.error) return apiError("PREVIEW_UNAVAILABLE", "The preview image is temporarily unavailable.", 404);
    return new Response(null, { status: 307, headers: { location: signed.data.signedUrl, "cache-control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("PREVIEW_LOAD_FAILED", "The preview image could not be loaded.", 500);
  }
}
