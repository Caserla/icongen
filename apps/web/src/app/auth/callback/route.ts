import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { publicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  const localOrigin =
    requestHost === "localhost:3000" || requestHost === "127.0.0.1:3000"
      ? `http://${requestHost}`
      : url.origin;
  const redirectOrigin =
    process.env.NODE_ENV === "development" ? localOrigin : publicEnv.appUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const flow = url.searchParams.get("flow");
  const isRecovery = flow === "recovery" || type === "recovery";
  const next =
    isRecovery
      ? "/auth/reset-password"
      : safeNextPath(url.searchParams.get("next"));

  if (tokenHash && type === "recovery") {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, redirectOrigin));
    }
  }

  // Keep accepting existing PKCE links while the hosted email template is
  // being rolled over. These links only work in the browser that requested
  // them because the code verifier is stored in that browser's cookies.
  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, redirectOrigin));
  }

  return NextResponse.redirect(
    new URL(
      isRecovery
        ? "/auth/forgot-password?error=invalid_recovery_link"
        : "/auth/sign-in?error=invalid_callback",
      redirectOrigin,
    ),
  );
}
