import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const verified = new URL("/auth/verified", url.origin);
      verified.searchParams.set("next", next);
      return NextResponse.redirect(verified);
    }
  }

  return NextResponse.redirect(new URL("/auth/sign-in?error=invalid_callback", url.origin));
}
