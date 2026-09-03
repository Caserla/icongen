import "server-only";
import type { User } from "@supabase/supabase-js";
import { requireActiveUser } from "@/lib/auth/require-user";

export class AdminAuthorizationError extends Error {}

export async function requireAdminUser(): Promise<User> {
  const user = await requireActiveUser();
  if (user.app_metadata.role !== "admin")
    throw new AdminAuthorizationError("Administrator access is required.");
  return user;
}
