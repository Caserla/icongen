import { disableCdKeyBatchSchema } from "@/features/admin/server/admin-schemas";
import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { adminErrorResponse } from "@/features/admin/server/admin-response";
import { apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> },
) {
  try {
    const user = await requireAdminUser();
    const { batchId } = await context.params;
    const parsed = disableCdKeyBatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return apiError(
        "DISABLE_REASON_REQUIRED",
        "Enter a reason for disabling this batch.",
        400,
      );
    const result = await createAdminSupabaseClient().rpc(
      "disable_credit_redemption_batch",
      {
        p_admin_user_id: user.id,
        p_batch_id: batchId,
        p_reason: parsed.data.reason,
      },
    );
    if (result.error) throw result.error;
    return Response.json({ disabledCodes: result.data });
  } catch (error) {
    return (
      adminErrorResponse(error) ??
      apiError(
        "CD_KEY_BATCH_DISABLE_FAILED",
        "The CD-Key batch could not be disabled.",
        500,
      )
    );
  }
}
