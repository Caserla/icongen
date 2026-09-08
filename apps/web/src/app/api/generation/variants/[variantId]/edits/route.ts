import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { startLocalVariantEdit } from "@/features/generation/server/local-generation-runner";
import {
  isVariantEditLeaseStale,
  type ActiveVariantEdit,
} from "@/features/generation/server/variant-edit-lease";
import { latestVariantEditFailure } from "@/features/generation/server/latest-variant-edit-failure";
import { remainingDetailEdits } from "@/features/generation/server/variant-edit-quota";

const paramsSchema = z.object({ variantId: z.string().uuid() });
const bodySchema = z.object({
  instruction: z.string().trim().min(5).max(500),
  idempotencyKey: z.string().uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success)
    return apiError(
      "INVALID_VARIANT_EDIT",
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
    const variantData = variant.data;
    const subject = await client
      .from("generation_subjects")
      .select("job_id")
      .eq("id", variantData.subject_id)
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
    const usedEdits = await client
      .from("generation_variant_revisions")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantData.id)
      .or("status.eq.completed,error_code.eq.VARIANT_EDIT_DISCARDED");
    if (usedEdits.error) throw usedEdits.error;
    const remainingDetailEditCount = remainingDetailEdits(usedEdits.count ?? 0);
    let currentBucket: string | null | undefined;
    let currentPath: string | null | undefined;
    if (variantData.active_revision_id) {
      const currentRevision = await client
        .from("generation_variant_revisions")
        .select("preview_bucket,preview_path")
        .eq("id", variantData.active_revision_id)
        .eq("variant_id", variantData.id)
        .maybeSingle();
      if (currentRevision.error) throw currentRevision.error;
      currentBucket = currentRevision.data?.preview_bucket;
      currentPath = currentRevision.data?.preview_path;
    } else {
      const originalPreview = await client
        .from("generation_assets")
        .select("storage_bucket,storage_path")
        .eq("variant_id", variantData.id)
        .eq("asset_role", "preview")
        .eq("format", "png")
        .maybeSingle();
      if (originalPreview.error) throw originalPreview.error;
      currentBucket = originalPreview.data?.storage_bucket;
      currentPath = originalPreview.data?.storage_path;
    }
    let currentPreviewUrl: string | null = null;
    if (currentBucket && currentPath) {
      const currentSigned = await client.storage
        .from(currentBucket)
        .createSignedUrl(currentPath, 3600);
      if (currentSigned.error) throw currentSigned.error;
      currentPreviewUrl = currentSigned.data.signedUrl;
    }
    const activeRevision = await client
      .from("generation_variant_revisions")
      .select("id,status,instruction,created_at,updated_at")
      .eq("variant_id", variantData.id)
      .in("status", ["queued", "processing"])
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeRevision.error) throw activeRevision.error;
    if (
      activeRevision.data &&
      isVariantEditLeaseStale(activeRevision.data as ActiveVariantEdit)
    ) {
      const now = new Date().toISOString();
      const stale = activeRevision.data as ActiveVariantEdit;
      const released = await client
        .from("generation_variant_revisions")
        .update({
          status: "failed",
          error_code: "VARIANT_EDIT_LEASE_EXPIRED",
          error_message:
            stale.status === "queued"
              ? "The edit worker did not claim this request before the dispatch timeout."
              : "The edit worker stopped reporting progress before its lease expired.",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", stale.id)
        .eq("status", stale.status)
        .eq("updated_at", stale.updated_at);
      if (released.error) throw released.error;
      const refund = await client.rpc("refund_failed_variant_detail_edit_v2", {
        p_revision_id: stale.id,
      });
      if (refund.error && refund.error.code !== "PGRST202") throw refund.error;
    } else if (activeRevision.data) {
      return Response.json({
        inProgress: {
          id: activeRevision.data.id,
          status: activeRevision.data.status,
          instruction: activeRevision.data.instruction,
        },
        draft: null,
        currentPreviewUrl,
        activeRevisionId: variantData.active_revision_id,
        remainingDetailEdits: remainingDetailEditCount,
      });
    }
    const latestRevision = await client
      .from("generation_variant_revisions")
      .select("id,status,instruction,error_code,error_message")
      .eq("variant_id", variantData.id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestRevision.error) throw latestRevision.error;
    const lastInstruction = latestRevision.data?.instruction ?? null;
    const latestFailure = latestVariantEditFailure(latestRevision.data);
    const revisions = await client
      .from("generation_variant_revisions")
      .select(
        "id,parent_revision_id,status,preview_bucket,preview_path,completed_at",
      )
      .eq("variant_id", variantData.id)
      .eq("status", "completed")
      .order("revision_number", { ascending: false })
      .limit(10);
    if (revisions.error) throw revisions.error;
    const pending = revisions.data?.find(
      (revision) =>
        revision.id !== variantData.active_revision_id &&
        revision.parent_revision_id === variantData.active_revision_id &&
        Boolean(revision.preview_bucket && revision.preview_path),
    );
    if (!pending?.preview_bucket || !pending.preview_path)
      return Response.json({
        draft: null,
        currentPreviewUrl,
        activeRevisionId: variantData.active_revision_id,
        lastInstruction,
        latestFailure,
        remainingDetailEdits: remainingDetailEditCount,
      });
    const signed = await client.storage
      .from(pending.preview_bucket)
      .createSignedUrl(pending.preview_path, 3600);
    if (signed.error) throw signed.error;
    return Response.json({
      draft: { id: pending.id, previewUrl: signed.data.signedUrl },
      currentPreviewUrl,
      activeRevisionId: variantData.active_revision_id,
      lastInstruction,
      latestFailure,
      remainingDetailEdits: remainingDetailEditCount,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success)
    return apiError(
      "INVALID_VARIANT_EDIT",
      "Enter a detail adjustment between 5 and 500 characters.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const variant = await client
      .from("generation_variants")
      .select("id,subject_id,status,active_revision_id")
      .eq("id", params.data.variantId)
      .maybeSingle();
    if (variant.error) throw variant.error;
    if (!variant.data || variant.data.status !== "completed")
      return apiError(
        "VARIANT_NOT_EDITABLE",
        "Only completed icon options can be adjusted.",
        409,
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
    const active = await client
      .from("generation_variant_revisions")
      .select("id,status,created_at,updated_at")
      .eq("variant_id", variant.data.id)
      .in("status", ["queued", "processing"])
      .maybeSingle();
    if (active.error) throw active.error;
    if (active.data) {
      const activeEdit = active.data as ActiveVariantEdit;
      if (!isVariantEditLeaseStale(activeEdit))
        return apiError(
          "VARIANT_EDIT_IN_PROGRESS",
          "This option is already being adjusted.",
          409,
        );
      const now = new Date().toISOString();
      const released = await client
        .from("generation_variant_revisions")
        .update({
          status: "failed",
          error_code: "VARIANT_EDIT_LEASE_EXPIRED",
          error_message:
            activeEdit.status === "queued"
              ? "The edit worker did not claim this request before the dispatch timeout."
              : "The edit worker stopped reporting progress before its lease expired.",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", activeEdit.id)
        .eq("status", activeEdit.status)
        .eq("updated_at", activeEdit.updated_at);
      if (released.error) throw released.error;
      const refund = await client.rpc("refund_failed_variant_detail_edit_v2", {
        p_revision_id: activeEdit.id,
      });
      if (refund.error && refund.error.code !== "PGRST202") throw refund.error;
    }
    const created = await client.rpc("create_variant_detail_edit_v2", {
      p_user_id: user.id,
      p_variant_id: variant.data.id,
      p_instruction: body.data.instruction,
      p_idempotency_key: body.data.idempotencyKey,
    });
    if (created.error) {
      if (created.error.message.includes("INSUFFICIENT_CREDITS")) {
        const account = await client
          .from("credit_accounts")
          .select("balance")
          .eq("user_id", user.id)
          .single();
        return apiError(
          "INSUFFICIENT_CREDITS",
          "You need 1 credit for this detail adjustment.",
          402,
          { required: 1, balance: account.data?.balance ?? null },
        );
      }
      if (created.error.message.includes("VARIANT_EDIT_IN_PROGRESS"))
        return apiError(
          "VARIANT_EDIT_IN_PROGRESS",
          "This option is already being adjusted.",
          409,
        );
      if (
        created.error.code === "PGRST202" ||
        created.error.message.includes("create_variant_detail_edit_v2")
      )
        return apiError(
          "VARIANT_EDIT_DATABASE_MIGRATION_REQUIRED",
          "Paid detail adjustments are temporarily unavailable.",
          503,
        );
      throw created.error;
    }
    const revision = created.data as {
      id: string;
      revisionNumber: number;
      status: string;
      remainingDetailEdits: number;
      chargedCredits: number;
    };
    startLocalVariantEdit(revision.id);
    return Response.json(revision, { status: 202 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "VARIANT_EDIT_CREATE_FAILED",
        "The detail adjustment could not start.",
        500,
      )
    );
  }
}
