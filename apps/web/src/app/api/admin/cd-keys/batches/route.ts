import { createCdKeyBatchSchema } from "@/features/admin/server/admin-schemas";
import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { adminErrorResponse } from "@/features/admin/server/admin-response";
import { apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser();
    const parsed = createCdKeyBatchSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return apiError(
        "INVALID_CD_KEY_BATCH",
        "Check the CD-Key batch settings.",
        400,
        parsed.error.flatten(),
      );
    const admin = createAdminSupabaseClient();
    const result = await admin.rpc("create_credit_redemption_batch", {
      p_admin_user_id: user.id,
      p_name: parsed.data.name,
      p_credits: parsed.data.credits,
      p_code_count: parsed.data.count,
      p_expires_at: parsed.data.expiresAt,
      p_channel: parsed.data.channel || null,
      p_note: parsed.data.note || null,
    });
    if (result.error) throw result.error;
    const rows = (result.data ?? []) as Array<{
      batch_id: string;
      generated_code: string;
    }>;
    return Response.json(
      {
        batchId: rows[0]?.batch_id,
        codes: rows.map((row) => row.generated_code),
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return (
      adminErrorResponse(error) ??
      apiError(
        "CD_KEY_BATCH_CREATE_FAILED",
        "The CD-Key batch could not be created.",
        500,
      )
    );
  }
}
