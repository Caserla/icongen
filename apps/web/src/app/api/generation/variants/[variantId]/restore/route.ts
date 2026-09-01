import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({ variantId: z.string().uuid() });

export async function POST(
  _request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success)
    return apiError(
      "INVALID_VARIANT_ID",
      "The icon option ID is invalid.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const variant = await client
      .from("generation_variants")
      .select("id,subject_id,active_revision_id")
      .eq("id", params.data.variantId)
      .maybeSingle();
    if (variant.error) throw variant.error;
    if (!variant.data)
      return apiError(
        "GENERATION_VARIANT_NOT_FOUND",
        "The icon option was not found.",
        404,
      );
    const subject = await client
      .from("generation_subjects")
      .select("job_id")
      .eq("id", variant.data.subject_id)
      .single();
    if (subject.error) throw subject.error;
    const job = await client
      .from("generation_jobs")
      .select("id")
      .eq("id", subject.data.job_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (job.error) throw job.error;
    if (!job.data)
      return apiError(
        "GENERATION_VARIANT_NOT_FOUND",
        "The icon option was not found.",
        404,
      );
    await client
      .from("generation_variant_revisions")
      .update({
        status: "failed",
        error_code: "RESTORED_DURING_EDIT",
        error_message: "Restored to the previous version",
        updated_at: new Date().toISOString(),
      })
      .eq("variant_id", variant.data.id)
      .in("status", ["queued", "processing"]);
    let previousRevisionId: string | null = null;
    if (variant.data.active_revision_id) {
      const activeRevision = await client
        .from("generation_variant_revisions")
        .select("parent_revision_id")
        .eq("id", variant.data.active_revision_id)
        .single();
      if (activeRevision.error) throw activeRevision.error;
      previousRevisionId = activeRevision.data.parent_revision_id;
    }
    const updated = await client
      .from("generation_variants")
      .update({
        active_revision_id: previousRevisionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variant.data.id);
    if (updated.error) throw updated.error;
    return Response.json({
      variantId: variant.data.id,
      activeRevisionId: previousRevisionId,
      restored: true,
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "VARIANT_RESTORE_FAILED",
        "The original option could not be restored.",
        500,
      )
    );
  }
}
