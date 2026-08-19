import type { AccountSummary } from "@icongen/shared";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabaseClient();
    const [profile, credits] = await Promise.all([
      supabase.from("profiles").select("display_name,status,created_at").eq("id", user.id).single(),
      supabase.from("credit_accounts").select("balance").eq("user_id", user.id).single(),
    ]);
    if (profile.error || credits.error) return apiError("ACCOUNT_LOAD_FAILED", "We could not load your account.", 500);

    const account: AccountSummary = {
      id: user.id,
      email: user.email ?? "",
      emailVerified: Boolean(user.email_confirmed_at),
      displayName: profile.data.display_name,
      creditBalance: credits.data.balance,
      status: profile.data.status,
      createdAt: profile.data.created_at,
    };
    return Response.json(account);
  } catch (error) {
    return authErrorResponse(error) ?? apiError("ACCOUNT_LOAD_FAILED", "We could not load your account.", 500);
  }
}

