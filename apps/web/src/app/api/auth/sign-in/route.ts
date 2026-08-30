import { signInSchema } from "@icongen/shared";
import { safeNextPath } from "@/lib/auth/safe-next";
import { apiError } from "@/lib/http/api-response";
import { publicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = signInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Please check your email and password.", 400, parsed.error.flatten());
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return apiError("AUTH_SERVICE_UNAVAILABLE", "Sign-in is temporarily unavailable. Please try again later.", 503);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return apiError("INVALID_CREDENTIALS", "The email or password is incorrect.", 401);
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return apiError("EMAIL_NOT_VERIFIED", "Verify your email before signing in.", 403);
  }

  return Response.json({ userId: data.user.id, next: safeNextPath(parsed.data.next) });
}
