import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  isVariantEditLeaseStale,
  type ActiveVariantEdit,
} from "@/features/generation/server/variant-edit-lease";

const paramsSchema = z.object({
  variantId: z.string().uuid(),
  editId: z.string().uuid(),
});

export async function GET(
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
      .select(
        "id,variant_id,revision_number,status,error_code,error_message,preview_bucket,preview_path,created_at,updated_at,completed_at",
      )
      .eq("id", params.data.editId)
      .eq("variant_id", params.data.variantId)
      .maybeSingle();
    if (revision.error) throw revision.error;
    if (!revision.data)
      return apiError(
        "VARIANT_EDIT_NOT_FOUND",
        "The detail adjustment was not found.",
        404,
      );
    const variant = await client
      .from("generation_variants")
      .select("subject_id,active_revision_id")
      .eq("id", params.data.variantId)
      .single();
    if (variant.error) throw variant.error;
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
        "VARIANT_EDIT_NOT_FOUND",
        "The detail adjustment was not found.",
        404,
      );
    if (
      (revision.data.status === "queued" ||
        revision.data.status === "processing") &&
      isVariantEditLeaseStale(revision.data as ActiveVariantEdit)
    ) {
      const now = new Date().toISOString();
      const released = await client
        .from("generation_variant_revisions")
        .update({
          status: "failed",
          error_code: "VARIANT_EDIT_LEASE_EXPIRED",
          error_message:
            revision.data.status === "queued"
              ? "The edit worker did not claim this request before the dispatch timeout."
              : "The edit worker stopped reporting progress before its lease expired.",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", revision.data.id)
        .eq("status", revision.data.status)
        .eq("updated_at", revision.data.updated_at);
      if (released.error) throw released.error;
      return Response.json({
        ...revision.data,
        status: "failed",
        error_code: "VARIANT_EDIT_LEASE_EXPIRED",
        error_message:
          "The adjustment worker was interrupted. Please try again.",
        completed_at: now,
      });
    }
    let previewUrl: string | undefined;
    if (revision.data.preview_bucket && revision.data.preview_path) {
      const signed = await client.storage
        .from(revision.data.preview_bucket)
        .createSignedUrl(revision.data.preview_path, 3600);
      if (!signed.error) previewUrl = signed.data.signedUrl;
    }
    return Response.json({
      ...revision.data,
      previewUrl,
      active: variant.data.active_revision_id === revision.data.id,
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "VARIANT_EDIT_READ_FAILED",
        "The detail adjustment could not be loaded.",
        500,
      )
    );
  }
}

export async function DELETE(
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
    const variant = await client
      .from("generation_variants")
      .select("subject_id,active_revision_id")
      .eq("id", params.data.variantId)
      .single();
    if (variant.error) throw variant.error;
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
        "VARIANT_EDIT_NOT_FOUND",
        "The detail adjustment was not found.",
        404,
      );
    if (variant.data.active_revision_id === params.data.editId)
      return apiError(
        "ACTIVE_VARIANT_EDIT",
        "The active version cannot be discarded.",
        409,
      );
    const now = new Date().toISOString();
    const revision = await client
      .from("generation_variant_revisions")
      .update({
        status: "failed",
        error_code: "VARIANT_EDIT_DISCARDED",
        error_message:
          "The pending adjustment was discarded in version comparison.",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", params.data.editId)
      .eq("variant_id", params.data.variantId)
      .eq("status", "completed")
      .select("id")
      .maybeSingle();
    if (revision.error) throw revision.error;
    if (!revision.data)
      return apiError(
        "VARIANT_EDIT_NOT_FOUND",
        "The pending adjustment was not found.",
        404,
      );
    return Response.json({ discarded: true });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "VARIANT_EDIT_DISCARD_FAILED",
        "The detail adjustment could not be discarded.",
        500,
      )
    );
  }
}
