import { emailRequestSchema } from "@icongen/shared";
import { publicEnv } from "@/lib/env";
import { apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = emailRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Enter a valid email address.", 400, parsed.error.flatten());

  const supabase = await createServerSupabaseClient();
  const redirectTo = new URL("/auth/callback?next=/auth/reset-password", publicEnv.appUrl).toString();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  return Response.json({ message: "If an account exists, a password reset email has been sent." });
}

