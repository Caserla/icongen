import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { startLocalGenerationJob } from "@/features/generation/server/local-generation-runner";

const paramsSchema = z.object({ variantId: z.string().uuid() });

export async function POST(_request: Request, context: { params: Promise<{ variantId: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiError("INVALID_VARIANT_ID", "The icon variant ID is invalid.", 400);

  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const variantResult = await client.from("generation_variants").select("id,subject_id,status").eq("id", parsed.data.variantId).maybeSingle();
    if (variantResult.error) throw variantResult.error;
    if (!variantResult.data) return apiError("GENERATION_VARIANT_NOT_FOUND", "The icon variant was not found.", 404);
    if (variantResult.data.status !== "failed") return apiError("VARIANT_NOT_FAILED", "Only failed icon variants can be regenerated.", 409);

    const subjectResult = await client.from("generation_subjects").select("id,job_id").eq("id", variantResult.data.subject_id).maybeSingle();
    if (subjectResult.error) throw subjectResult.error;
    if (!subjectResult.data) return apiError("GENERATION_VARIANT_NOT_FOUND", "The icon variant was not found.", 404);
    const jobResult = await client.from("generation_jobs").select("id,user_id").eq("id", subjectResult.data.job_id).eq("user_id", user.id).maybeSingle();
    if (jobResult.error) throw jobResult.error;
    if (!jobResult.data) return apiError("GENERATION_VARIANT_NOT_FOUND", "The icon variant was not found.", 404);

    const now = new Date().toISOString();
    const variantUpdate = await client.from("generation_variants").update({ status: "queued", started_at: null, completed_at: null, error_code: null, error_message: null, updated_at: now }).eq("id", parsed.data.variantId).eq("status", "failed");
    if (variantUpdate.error) throw variantUpdate.error;
    const subjectUpdate = await client.from("generation_subjects").update({ status: "processing", error_code: null, error_message: null, updated_at: now }).eq("id", subjectResult.data.id);
    if (subjectUpdate.error) throw subjectUpdate.error;
    const jobUpdate = await client.from("generation_jobs").update({ status: "queued", progress_phase: "queued", completed_at: null, error_code: null, error_message: null, updated_at: now }).eq("id", jobResult.data.id).eq("user_id", user.id);
    if (jobUpdate.error) throw jobUpdate.error;

    startLocalGenerationJob(jobResult.data.id);
    return Response.json({ jobId: jobResult.data.id, variantId: parsed.data.variantId, status: "queued" }, { status: 202 });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("GENERATION_VARIANT_RETRY_FAILED", "We could not regenerate this icon variant.", 500);
  }
}
