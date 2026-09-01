import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { startLocalVariantEdit } from "@/features/generation/server/local-generation-runner";

const paramsSchema = z.object({ variantId: z.string().uuid() });
const bodySchema = z.object({ instruction: z.string().trim().min(5).max(500) });

export async function POST(request: Request, context: { params: Promise<{ variantId: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success)
    return apiError("INVALID_VARIANT_EDIT", "Enter a detail adjustment between 5 and 500 characters.", 400);
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const variant = await client.from("generation_variants")
      .select("id,subject_id,status,active_revision_id")
      .eq("id", params.data.variantId).maybeSingle();
    if (variant.error) throw variant.error;
    if (!variant.data || variant.data.status !== "completed")
      return apiError("VARIANT_NOT_EDITABLE", "Only completed icon options can be adjusted.", 409);
    const subject = await client.from("generation_subjects").select("job_id").eq("id", variant.data.subject_id).single();
    if (subject.error) throw subject.error;
    const job = await client.from("generation_jobs").select("id").eq("id", subject.data.job_id).eq("user_id", user.id).maybeSingle();
    if (job.error) throw job.error;
    if (!job.data) return apiError("GENERATION_VARIANT_NOT_FOUND", "The icon option was not found.", 404);
    const active = await client.from("generation_variant_revisions").select("id").eq("variant_id", variant.data.id).in("status", ["queued", "processing"]).maybeSingle();
    if (active.error) throw active.error;
    if (active.data) return apiError("VARIANT_EDIT_IN_PROGRESS", "This option is already being adjusted.", 409);
    const revisions = await client.from("generation_variant_revisions").select("revision_number").eq("variant_id", variant.data.id).order("revision_number", { ascending: false }).limit(1);
    if (revisions.error) throw revisions.error;
    const revision = await client.from("generation_variant_revisions").insert({
      variant_id: variant.data.id,
      parent_revision_id: variant.data.active_revision_id,
      revision_number: (revisions.data?.[0]?.revision_number ?? 0) + 1,
      instruction: body.data.instruction,
      status: "queued",
    }).select("id,revision_number,status").single();
    if (revision.error) throw revision.error;
    startLocalVariantEdit(revision.data.id);
    return Response.json(revision.data, { status: 202 });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("VARIANT_EDIT_CREATE_FAILED", "The detail adjustment could not start.", 500);
  }
}
