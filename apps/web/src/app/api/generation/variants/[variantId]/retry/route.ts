import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getLocalWorkerReservation,
  startLocalGenerationJob,
} from "@/features/generation/server/local-generation-runner";

const paramsSchema = z.object({ variantId: z.string().uuid() });

export async function POST(
  _request: Request,
  context: { params: Promise<{ variantId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success)
    return apiError(
      "INVALID_VARIANT_ID",
      "The icon variant ID is invalid.",
      400,
    );

  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const localReservation = getLocalWorkerReservation();
    const retried = await client.rpc(
      localReservation
        ? "retry_local_generation_variant_v2"
        : "retry_generation_variant_v2",
      {
        p_user_id: user.id,
        p_variant_id: parsed.data.variantId,
        ...(localReservation
          ? {
              p_worker_id: localReservation.workerId,
              p_lease_seconds: localReservation.leaseSeconds,
            }
          : {}),
      },
    );
    if (retried.error) {
      if (
        retried.error.code === "PGRST202" ||
        retried.error.message.includes("retry_generation_variant_v2") ||
        retried.error.message.includes("retry_local_generation_variant_v2")
      )
        return apiError(
          "GENERATION_DATABASE_MIGRATION_REQUIRED",
          "Generation retry is temporarily unavailable. Please try again later.",
          503,
        );
      if (retried.error.message.includes("GENERATION_VARIANT_NOT_FOUND"))
        return apiError(
          "GENERATION_VARIANT_NOT_FOUND",
          "The icon variant was not found.",
          404,
        );
      if (retried.error.message.includes("VARIANT_NOT_FAILED"))
        return apiError(
          "VARIANT_NOT_FAILED",
          "Only failed icon variants can be regenerated.",
          409,
        );
      throw retried.error;
    }

    const jobId = retried.data as string;
    await startLocalGenerationJob(jobId);
    return Response.json(
      { jobId, variantId: parsed.data.variantId, status: "queued" },
      { status: 202 },
    );
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "GENERATION_VARIANT_RETRY_FAILED",
        "This option could not restart. Try again in a moment.",
        500,
      )
    );
  }
}
