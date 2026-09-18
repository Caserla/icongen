import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectIconStatusChanges, projectIconStatusSchema } from "@/features/generation/server/project-icon-status";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid(), subjectId: z.string().min(1).max(120) });
type Context = { params: Promise<{ projectId: string; setId: string; subjectId: string }> };

export async function PATCH(request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_ICON", "Invalid project icon.", 400);
  const body = projectIconStatusSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", "Invalid favorite state.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const set = await client.from("project_svg_icon_sets").select("id")
      .eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    const changes = projectIconStatusChanges(body.data);
    const saved = await client.from("project_svg_icons").update(changes)
      .eq("set_id", params.data.setId).eq("subject_id", params.data.subjectId).select("subject_id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data) return apiError("ICON_NOT_FOUND", "Project icon not found.", 404);
    return Response.json({ saved: true, ...body.data });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("ICON_FAVORITE_SAVE_FAILED", "Icon favorite state could not be saved.", 503);
  }
}
