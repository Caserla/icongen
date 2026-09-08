import { emailRequestSchema } from "@icongen/shared";
import { publicEnv } from "@/lib/env";
import { apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = emailRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      "VALIDATION_ERROR",
      "Enter a valid email address.",
      400,
      parsed.error.flatten(),
    );
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey)
    return apiError(
      "AUTH_SERVICE_UNAVAILABLE",
      "Password recovery is temporarily unavailable. Please try again later.",
      503,
    );

  const supabase = await createServerSupabaseClient();
  const redirectTo = new URL(
    "/auth/callback?flow=recovery",
    publicEnv.appUrl,
  ).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo },
  );
  if (error)
    return apiError(
      "PASSWORD_RECOVERY_FAILED",
      "Password recovery is temporarily unavailable. Please try again later.",
      503,
    );
  return Response.json({
    message:
      "If an account matches that email, we sent password reset instructions.",
  });
}
