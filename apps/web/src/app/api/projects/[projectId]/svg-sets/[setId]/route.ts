import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectIconStatusChanges, projectIconStatusSchema } from "@/features/generation/server/project-icon-status";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid() });
type Context = { params: Promise<{ projectId: string; setId: string }> };

export async function PATCH(request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_SET", "Invalid icon set.", 400);
  const body = projectIconStatusSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", "Invalid favorite state.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const changes = projectIconStatusChanges(body.data);
    const saved = await client.from("project_svg_icon_sets").update(changes)
      .eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).select("id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    return Response.json({ saved: true, ...body.data });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("FAVORITE_SAVE_FAILED", "Favorite state could not be saved.", 503);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_SET", "Invalid icon set.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const removed = await client.from("project_svg_icon_sets").delete()
      .eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).select("id").maybeSingle();
    if (removed.error) throw removed.error;
    if (!removed.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    return Response.json({ deleted: true });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("SET_DELETE_FAILED", "Icon set could not be deleted.", 503);
  }
}
