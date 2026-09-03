import { updateProfileSchema } from "@icongen/shared";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Display name must be between 1 and 18 characters.", 400, parsed.error.flatten());

  try {
    const user = await requireActiveUser();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data.displayName })
      .eq("id", user.id)
      .select("display_name,updated_at")
      .single();
    if (error) return apiError("PROFILE_UPDATE_FAILED", "Your profile was not saved. Check your connection and try again.", 500);
    return Response.json({ displayName: data.display_name, updatedAt: data.updated_at });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("PROFILE_UPDATE_FAILED", "Your profile was not saved. Check your connection and try again.", 500);
  }
}
