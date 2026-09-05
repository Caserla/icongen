import { signUpSchema } from "@icongen/shared";
import { isPublicSignupEnabled, publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/safe-next";
import { apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isPublicSignupEnabled()) return apiError("SIGN_UP_DISABLED", "Public sign-up is not enabled in this environment.", 403);
  const parsed = signUpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Please check your registration details.", 400, parsed.error.flatten());
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return apiError("AUTH_SERVICE_UNAVAILABLE", "Sign-up is temporarily unavailable. Please try again later.", 503);

  const next = safeNextPath(parsed.data.next);
  const emailRedirectTo = new URL(`/auth/callback?next=${encodeURIComponent(next)}`, publicEnv.appUrl).toString();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo },
  });

  if (error) return apiError("SIGN_UP_FAILED", "We could not create your account. Please try again.", 400);
  return Response.json({ requiresEmailVerification: !data.session, next }, { status: 201 });
}
