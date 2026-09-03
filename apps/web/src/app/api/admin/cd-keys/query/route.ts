import { adminListSchema } from "@/features/admin/server/admin-schemas";
import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { adminErrorResponse } from "@/features/admin/server/admin-response";
import { apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;
export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const parsed = adminListSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return apiError("INVALID_ADMIN_QUERY", "Check the query.", 400);
    const from = (parsed.data.page - 1) * PAGE_SIZE;
    const admin = createAdminSupabaseClient();
    let query = admin
      .from("credit_redemption_batches")
      .select(
        "id,name,credits_per_code,code_count,expires_at,channel,note,disabled_at,created_at,credit_redemption_codes(id,redeemed_at,disabled_at)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (parsed.data.query)
      query = query.ilike(
        "name",
        `%${parsed.data.query.replace(/[%_]/g, "")}%`,
      );
    const result = await query;
    if (result.error) throw result.error;
    return Response.json({
      items: result.data ?? [],
      page: parsed.data.page,
      pages: Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE)),
      total: result.count ?? 0,
    });
  } catch (error) {
    return (
      adminErrorResponse(error) ??
      apiError(
        "CD_KEY_BATCH_QUERY_FAILED",
        "CD-Key batches could not be loaded.",
        500,
      )
    );
  }
}
