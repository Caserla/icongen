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
      return apiError(
        "INVALID_ADMIN_QUERY",
        "Check the generation query.",
        400,
      );
    const from = (parsed.data.page - 1) * PAGE_SIZE;
    let query = createAdminSupabaseClient()
      .from("generation_jobs")
      .select(
        "id,user_id,status,subject_count,style_preset,generation_spec,progress_percent,attempt_count,error_code,worker_lease_owner,worker_lease_expires_at,created_at,completed_at,profiles(email,display_name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (parsed.data.status !== "all")
      query = query.eq("status", parsed.data.status);
    if (parsed.data.query) {
      const term = parsed.data.query.replace(/[^a-zA-Z0-9-]/g, "");
      if (term) query = query.or(`id.eq.${term},user_id.eq.${term}`);
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
      apiError(
        "ADMIN_JOBS_QUERY_FAILED",
        "Generation jobs could not be loaded.",
        500,
      )
    );
  }
}
