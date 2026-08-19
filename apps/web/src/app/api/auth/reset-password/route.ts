import { resetPasswordSchema } from "@icongen/shared";
import { apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Use a password with at least 8 characters.", 400, parsed.error.flatten());

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return apiError("RECOVERY_SESSION_REQUIRED", "Open a valid password reset link first.", 401);
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return apiError("PASSWORD_RESET_FAILED", "We could not update your password.", 400);
  return Response.json({ updated: true });
}

