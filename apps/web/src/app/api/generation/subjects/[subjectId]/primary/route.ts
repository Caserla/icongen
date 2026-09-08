import { markPrimaryVariantSchema } from "@icongen/shared";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ subjectId: z.string().uuid() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  const body = markPrimaryVariantSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!params.success || !body.success)
    return apiError(
      "INVALID_PRIMARY_SELECTION",
      "The selected icon variant is invalid.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const { data: subject } = await client
      .from("generation_subjects")
      .select("id,job_id")
      .eq("id", params.data.subjectId)
      .maybeSingle();
    if (!subject)
      return apiError(
        "GENERATION_SUBJECT_NOT_FOUND",
        "The icon subject was not found.",
        404,
      );
    const { data: job } = await client
      .from("generation_jobs")
      .select("id")
      .eq("id", subject.job_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!job)
      return apiError(
        "GENERATION_SUBJECT_NOT_FOUND",
        "The icon subject was not found.",
        404,
      );
    const { data: variant } = await client
      .from("generation_variants")
      .select("id")
      .eq("id", body.data.variantId)
      .eq("subject_id", subject.id)
      .eq("status", "completed")
      .maybeSingle();
    if (!variant)
      return apiError(
        "INVALID_PRIMARY_SELECTION",
        "Only a completed variant from this subject can be marked.",
        400,
      );
    const marked = await client.rpc("set_generation_primary_variant", {
      p_subject_id: subject.id,
      p_variant_id: variant.id,
    });
    if (marked.error) throw marked.error;
    return Response.json({
      subjectId: subject.id,
      variantId: variant.id,
      isPrimary: true,
    });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "PRIMARY_SELECTION_FAILED",
        "We could not save the selected variant.",
        500,
      )
    );
  }
}
