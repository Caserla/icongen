import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({ assetId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success)
    return apiError(
      "INVALID_ASSET_ID",
      "The preview asset ID is invalid.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const assetResult = await client
      .from("generation_assets")
      .select("id,variant_id,format,storage_bucket,storage_path")
      .eq("id", parsed.data.assetId)
      .eq("format", "png")
      .maybeSingle();
    if (assetResult.error) throw assetResult.error;
    if (!assetResult.data)
      return apiError(
        "PREVIEW_NOT_FOUND",
        "The preview image was not found.",
        404,
      );
    const variantResult = await client
      .from("generation_variants")
      .select("subject_id")
      .eq("id", assetResult.data.variant_id)
      .maybeSingle();
    if (variantResult.error) throw variantResult.error;
    if (!variantResult.data)
      return apiError(
        "PREVIEW_NOT_FOUND",
        "The preview image was not found.",
        404,
      );
    const subjectResult = await client
      .from("generation_subjects")
      .select("job_id")
      .eq("id", variantResult.data.subject_id)
      .maybeSingle();
    if (subjectResult.error) throw subjectResult.error;
    if (!subjectResult.data)
      return apiError(
        "PREVIEW_NOT_FOUND",
        "The preview image was not found.",
        404,
      );
    const jobResult = await client
      .from("generation_jobs")
      .select("id")
      .eq("id", subjectResult.data.job_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (jobResult.error) throw jobResult.error;
    if (!jobResult.data)
      return apiError(
        "PREVIEW_NOT_FOUND",
        "The preview image was not found.",
        404,
      );
    const signed = await createAdminSupabaseClient()
      .storage.from(assetResult.data.storage_bucket)
      .createSignedUrl(assetResult.data.storage_path, 300);
    if (signed.error)
      return apiError(
        "PREVIEW_UNAVAILABLE",
        "The preview image is temporarily unavailable.",
        404,
      );
    return new Response(null, {
      status: 307,
      headers: {
        location: signed.data.signedUrl,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "PREVIEW_LOAD_FAILED",
        "The preview image could not be loaded.",
        500,
      )
    );
  }
}
