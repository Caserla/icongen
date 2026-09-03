import { adminListSchema } from "@/features/admin/server/admin-schemas";
import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { adminErrorResponse } from "@/features/admin/server/admin-response";
import { apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 30;
export async function POST(request: Request) {
  try {
    await requireAdminUser();
    const parsed = adminListSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success)
      return apiError("INVALID_ADMIN_QUERY", "Check the audit query.", 400);
    const from = (parsed.data.page - 1) * PAGE_SIZE;
    let query = createAdminSupabaseClient()
      .from("admin_audit_logs")
      .select(
        "id,actor_user_id,action,target_type,target_id,metadata,created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (parsed.data.query)
      query = query.ilike(
        "action",
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
        "ADMIN_AUDIT_QUERY_FAILED",
        "Audit records could not be loaded.",
        500,
      )
    );
  }
}
