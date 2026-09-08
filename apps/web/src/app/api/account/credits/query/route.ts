import type { CreditHistoryItem, CreditHistoryResponse } from "@/lib/credits";
import {
  CREDIT_HISTORY_PAGE_SIZE,
  parseCreditHistoryRequest,
} from "@/lib/credits";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    const { kind, page } = parseCreditHistoryRequest(
      await request.json().catch(() => null),
    );
    const supabase = await createServerSupabaseClient();
    const from = (page - 1) * CREDIT_HISTORY_PAGE_SIZE;
    const to = from + CREDIT_HISTORY_PAGE_SIZE - 1;

    let ledgerQuery = supabase
      .from("credit_ledger")
      .select(
        "id,entry_type,amount,balance_after,generation_job_id,order_id,note,created_at",
        { count: "exact" },
      )
      .eq("user_id", user.id);
    if (kind === "usage")
      ledgerQuery = ledgerQuery.eq("entry_type", "generation_debit");
    if (kind === "topup")
      ledgerQuery = ledgerQuery.in("entry_type", [
        "purchase",
        "signup_bonus",
        "cd_key_redemption",
      ]);

    const [accountResult, ledgerResult] = await Promise.all([
      supabase
        .from("credit_accounts")
        .select("balance")
        .eq("user_id", user.id)
        .single(),
      ledgerQuery.order("created_at", { ascending: false }).range(from, to),
    ]);

    if (accountResult.error || ledgerResult.error) {
      return apiError(
        "CREDIT_HISTORY_LOAD_FAILED",
        "Credit records could not be loaded.",
        500,
      );
    }

    const total = ledgerResult.count ?? 0;
    const items: CreditHistoryItem[] = (ledgerResult.data ?? []).map(
      (entry) => ({
        id: entry.id,
        entryType: entry.entry_type,
        amount: entry.amount,
        balanceAfter: entry.balance_after,
        generationJobId: entry.generation_job_id,
        orderId: entry.order_id,
        note: entry.note,
        createdAt: entry.created_at,
      }),
    );
    const response: CreditHistoryResponse = {
      balance: accountResult.data.balance,
      items,
      page,
      pageSize: CREDIT_HISTORY_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / CREDIT_HISTORY_PAGE_SIZE)),
    };
    return Response.json(response);
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError(
        "CREDIT_HISTORY_LOAD_FAILED",
        "Credit records could not be loaded.",
        500,
      )
    );
  }
}
