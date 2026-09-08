import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({ variantId: z.string().uuid() });

export async function DELETE(_request: Request, context: { params: Promise<{ variantId: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_FAVORITE", "Choose a valid icon option.", 400);
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const { error } = await client
      .from("generation_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("variant_id", params.data.variantId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("FAVORITE_DELETE_FAILED", "The favorite could not be removed.", 500);
  }
}
