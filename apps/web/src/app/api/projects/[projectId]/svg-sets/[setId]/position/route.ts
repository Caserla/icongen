import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid() });
const positionSchema = z.object({
  x: z.number().finite().min(-100_000).max(100_000),
  y: z.number().finite().min(-100_000).max(100_000),
});
type Context = { params: Promise<{ projectId: string; setId: string }> };

export async function PUT(request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_SET", "Invalid icon set.", 400);
  const position = positionSchema.safeParse(await request.json().catch(() => null));
  if (!position.success) return apiError("INVALID_POSITION", "Invalid canvas position.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const saved = await client.from("project_svg_icon_sets")
      .update({ canvas_position: position.data })
      .eq("id", params.data.setId)
      .eq("project_id", params.data.projectId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    return Response.json({ saved: true, position: position.data });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("POSITION_SAVE_FAILED", "Icon set position could not be saved.", 503);
  }
}
