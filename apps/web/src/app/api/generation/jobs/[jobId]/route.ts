import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readGenerationJob } from "@/features/generation/server/generation-job-reader";

const paramsSchema = z.object({ jobId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success)
    return apiError(
      "INVALID_JOB_ID",
      "The generation task ID is invalid.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const job = await readGenerationJob(client, user.id, parsed.data.jobId, {
      signer: createAdminSupabaseClient(),
    });
    if (!job)
      return apiError(
        "GENERATION_JOB_NOT_FOUND",
        "The generation task was not found.",
        404,
      );
    return Response.json(job);
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "GENERATION_JOB_LOAD_FAILED",
        "We could not load the generation task.",
        500,
      )
    );
  }
}
