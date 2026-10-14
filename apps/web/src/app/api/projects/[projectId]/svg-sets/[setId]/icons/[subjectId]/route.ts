import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { projectIconStatusChanges, projectIconStatusSchema } from "@/features/generation/server/project-icon-status";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid(), subjectId: z.string().min(1).max(120) });
const storedPlanSchema = z.object({
  subjects: z.array(z.object({ id: z.string().min(1).max(120), name: z.string(), description: z.string() }).passthrough()),
}).passthrough();
type Context = { params: Promise<{ projectId: string; setId: string; subjectId: string }> };

export async function GET(_request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_ICON", "Invalid project icon.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const set = await client.from("project_svg_icon_sets").select("id")
      .eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    const icon = await client.from("project_svg_icons").select("style_variants")
      .eq("set_id", params.data.setId).eq("subject_id", params.data.subjectId).maybeSingle();
    if (icon.error) throw icon.error;
    if (!icon.data) return apiError("ICON_NOT_FOUND", "Project icon not found.", 404);
    const variants = icon.data.style_variants;
    if (!variants || typeof variants !== "object") return apiError("STYLE_FAMILY_NOT_FOUND", "This icon has no six-style family.", 404);
    return Response.json({ variants }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("STYLE_FAMILY_UNAVAILABLE", "Icon styles unavailable.", 503);
  }
}

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

export async function DELETE(_request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_ICON", "Invalid project icon.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const set = await client.from("project_svg_icon_sets").select("id,plan")
      .eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    const parsedPlan = storedPlanSchema.safeParse(set.data.plan);
    if (!parsedPlan.success) return apiError("INVALID_SET", "Icon set plan is invalid.", 409);
    const subjects = parsedPlan.data.subjects.filter(subject => subject.id !== params.data.subjectId);
    if (subjects.length === parsedPlan.data.subjects.length)
      return apiError("ICON_NOT_FOUND", "Project icon not found.", 404);
    if (!subjects.length) {
      const removedSet = await client.from("project_svg_icon_sets").delete()
        .eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).select("id").maybeSingle();
      if (removedSet.error) throw removedSet.error;
      if (!removedSet.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
      return Response.json({ deleted: true, setDeleted: true });
    }
    const removed = await client.from("project_svg_icons").delete()
      .eq("set_id", params.data.setId).eq("subject_id", params.data.subjectId).select("subject_id").maybeSingle();
    if (removed.error) throw removed.error;
    if (!removed.data) return apiError("ICON_NOT_FOUND", "Project icon not found.", 404);
    const updated = await client.from("project_svg_icon_sets").update({
      plan: { ...parsedPlan.data, subjects, count: subjects.length },
    }).eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).select("id").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    return Response.json({ deleted: true, setDeleted: false });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("ICON_DELETE_FAILED", "Project icon could not be deleted.", 503);
  }
}
