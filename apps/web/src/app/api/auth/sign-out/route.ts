import { apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) return apiError("SIGN_OUT_FAILED", "We could not sign you out. Please try again.", 500);
  return new Response(null, { status: 204 });
}

