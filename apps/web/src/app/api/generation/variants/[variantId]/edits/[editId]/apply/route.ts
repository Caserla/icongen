import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  variantId: z.string().uuid(),
  editId: z.string().uuid(),
});

export async function POST(
  _request: Request,
  context: { params: Promise<{ variantId: string; editId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success)
    return apiError(
      "INVALID_VARIANT_EDIT",
      "The detail adjustment ID is invalid.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const revision = await client
      .from("generation_variant_revisions")
      .select("id,variant_id,parent_revision_id,status")
      .eq("id", params.data.editId)
      .eq("variant_id", params.data.variantId)
      .maybeSingle();
    if (revision.error) throw revision.error;
    if (!revision.data || revision.data.status !== "completed")
      return apiError(
        "VARIANT_EDIT_NOT_READY",
        "This adjustment is not ready to save.",
        409,
      );
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
    if (variant.data.active_revision_id !== revision.data.parent_revision_id)
      return apiError(
        "VARIANT_EDIT_BASE_CHANGED",
        "The current icon changed after this adjustment was created. Generate the adjustment again.",
        409,
      );
    let updateQuery = client
      .from("generation_variants")
      .update({
        active_revision_id: revision.data.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variant.data.id);
    updateQuery = revision.data.parent_revision_id
      ? updateQuery.eq(
          "active_revision_id",
          revision.data.parent_revision_id,
        )
      : updateQuery.is("active_revision_id", null);
    const updated = await updateQuery.select("id").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data)
      return apiError(
        "VARIANT_EDIT_BASE_CHANGED",
        "The current icon changed while this adjustment was being saved. Generate the adjustment again.",
        409,
      );
    return Response.json({
      variantId: variant.data.id,
      activeRevisionId: revision.data.id,
      saved: true,
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "VARIANT_EDIT_SAVE_FAILED",
        "The adjustment could not be saved.",
        500,
      )
    );
  }
}
