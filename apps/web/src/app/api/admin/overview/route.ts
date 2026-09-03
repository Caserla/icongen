import { requireAdminUser } from "@/features/admin/server/admin-auth";
import { adminErrorResponse } from "@/features/admin/server/admin-response";
import { apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const admin = createAdminSupabaseClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const trendStart = new Date(today);
    trendStart.setUTCDate(trendStart.getUTCDate() - 13);
    const [
      users,
      jobs,
      queued,
      processing,
      failed,
      ledger,
      codes,
      limits,
      trendJobs,
      trendLedger,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin
        .from("generation_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today.toISOString()),
      admin
        .from("generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued"),
      admin
        .from("generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing"),
      admin
        .from("generation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", today.toISOString()),
      admin
        .from("credit_ledger")
        .select("entry_type,amount")
        .gte("created_at", today.toISOString())
        .limit(10000),
      admin
        .from("credit_redemption_codes")
        .select("id", { count: "exact", head: true })
        .not("redeemed_at", "is", null)
        .gte("redeemed_at", today.toISOString()),
      admin
        .from("generation_runtime_limits")
        .select("*")
        .eq("singleton", true)
        .maybeSingle(),
      admin
        .from("generation_jobs")
        .select("created_at")
        .gte("created_at", trendStart.toISOString())
        .limit(10000),
      admin
        .from("credit_ledger")
        .select("entry_type,amount,created_at")
        .eq("entry_type", "generation_debit")
        .gte("created_at", trendStart.toISOString())
        .limit(10000),
    ]);
    const failedQuery = [
      users,
      jobs,
      queued,
      processing,
      failed,
      ledger,
      codes,
      limits,
      trendJobs,
      trendLedger,
    ].find((result) => result.error);
    if (failedQuery?.error) throw failedQuery.error;
    const rows = ledger.data ?? [];
    const amount = (type: string) =>
      rows
        .filter((row) => row.entry_type === type)
        .reduce((sum, row) => sum + Number(row.amount), 0);
    const trend = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(trendStart);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        jobs: (trendJobs.data ?? []).filter((row) =>
          row.created_at.startsWith(key),
        ).length,
        credits: Math.abs(
          (trendLedger.data ?? [])
            .filter((row) => row.created_at.startsWith(key))
            .reduce((sum, row) => sum + Number(row.amount), 0),
        ),
      };
    });
    return Response.json(
      {
        users: users.count ?? 0,
        jobsToday: jobs.count ?? 0,
        queued: queued.count ?? 0,
        processing: processing.count ?? 0,
        failedToday: failed.count ?? 0,
        debitedToday: Math.abs(amount("generation_debit")),
        refundedToday: amount("generation_refund"),
        cdKeyCreditsToday: amount("cd_key_redemption"),
        cdKeysRedeemedToday: codes.count ?? 0,
        runtimeLimits: limits.data,
        trend,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return (
      adminErrorResponse(error) ??
      apiError(
        "ADMIN_OVERVIEW_FAILED",
        "Admin overview could not be loaded.",
        500,
      )
    );
  }
}
