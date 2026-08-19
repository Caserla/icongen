import { emailRequestSchema } from "@icongen/shared";
import { publicEnv } from "@/lib/env";
import { apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = emailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Enter a valid email address.", 400, parsed.error.flatten());

  const supabase = await createServerSupabaseClient();
  const emailRedirectTo = new URL("/auth/callback?next=/create", publicEnv.appUrl).toString();
  await supabase.auth.resend({ type: "signup", email: parsed.data.email, options: { emailRedirectTo } });
  return Response.json({ message: "If the account can be verified, a new email has been sent." });
}

