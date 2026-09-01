import { createGenerationJobSchema } from "@icongen/shared";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { startLocalGenerationJob } from "@/features/generation/server/local-generation-runner";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createGenerationJobSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_GENERATION_REQUEST",
      "Please check the generation request.",
      400,
      parsed.error.flatten(),
    );
  }

  try {
    const generationSpec = parsed.data;
    const user = await requireActiveUser();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("create_generation_job_v2", {
      p_user_id: user.id,
      p_spec: generationSpec,
      p_skill_version: "default-ui-icon@0.9.1",
      p_idempotency_key: generationSpec.idempotencyKey,
    });
    if (error) {
      console.error("create_generation_job_v2 failed", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (
        error.code === "PGRST202" ||
        error.message.includes("create_generation_job_v2")
      ) {
        return apiError(
          "GENERATION_DATABASE_MIGRATION_REQUIRED",
          "Generation is temporarily unavailable. Please try again later.",
          503,
        );
      }
      if (error.message.includes("settings version expired"))
        return apiError(
          "SETTINGS_VERSION_EXPIRED",
          "Icon settings were updated. Refresh the page, review your choices, and generate again.",
          409,
        );
      if (error.message.includes("active generation exists"))
        return apiError(
          "ACTIVE_JOB_LIMIT_REACHED",
          "Another icon set is still generating. Wait for it to finish before starting a new one.",
          409,
        );
      return apiError(
        "GENERATION_CREATE_FAILED",
        "Generation could not start. Your settings are still on this page; try again.",
        500,
      );
    }
    startLocalGenerationJob(data);
    return Response.json({ id: data, status: "queued" }, { status: 201 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError("AUTHORIZATION_FAILED", "We could not verify this account.", 500)
    );
  }
}
