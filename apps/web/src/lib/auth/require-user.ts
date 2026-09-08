import "server-only";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export class AuthError extends Error {
  constructor(
    readonly code:
      "AUTH_REQUIRED" | "EMAIL_NOT_VERIFIED" | "ACCOUNT_RESTRICTED",
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user)
    throw new AuthError("AUTH_REQUIRED", "Authentication is required.");
  return data.user;
}

export async function requireVerifiedUser(): Promise<User> {
  const user = await requireUser();
  if (!user.email_confirmed_at)
    throw new AuthError(
      "EMAIL_NOT_VERIFIED",
      "Email verification is required.",
    );
  return user;
}

export async function requireActiveUser(): Promise<User> {
  const user = await requireVerifiedUser();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();
  if (error || data?.status !== "active") {
    throw new AuthError(
      "ACCOUNT_RESTRICTED",
      "This account cannot perform this operation.",
    );
  }
  return user;
}
