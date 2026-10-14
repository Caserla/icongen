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
      return apiError("INVALID_ADMIN_QUERY", "Check the user query.", 400);
    const from = (parsed.data.page - 1) * PAGE_SIZE;
    let query = createAdminSupabaseClient()
      .from("profiles")
      .select(
        "id,email,display_name,status,created_at,updated_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (parsed.data.status !== "all")
      query = query.eq("status", parsed.data.status);
    if (parsed.data.query) {
      const term = parsed.data.query.replace(/[%_,()]/g, "");
      query = query.or(`email.ilike.%${term}%,display_name.ilike.%${term}%`);
    }
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
      apiError("ADMIN_USERS_QUERY_FAILED", "Users could not be loaded.", 500)
    );
  }
}
