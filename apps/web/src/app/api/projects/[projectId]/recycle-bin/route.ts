import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ projectId: z.string().uuid() });
type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_PROJECT_ID", "Invalid project.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const project = await client.from("icon_projects").select("id").eq("id", params.data.projectId).eq("user_id", user.id).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) return apiError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const sets = await client.from("project_svg_icon_sets").select("id,plan,recycled_at").eq("project_id", params.data.projectId).eq("user_id", user.id).order("created_at", { ascending: false });
    if (sets.error) throw sets.error;
    const ids = (sets.data ?? []).map(set => set.id);
    const icons = ids.length ? await client.from("project_svg_icons").select("set_id,subject_id,svg,recycled_at").in("set_id", ids) : { data: [], error: null };
    if (icons.error) throw icons.error;
    const recycledGroups = (sets.data ?? []).filter(set => set.recycled_at).map(set => ({ id: set.id, plan: set.plan, icons: Object.fromEntries((icons.data ?? []).filter(icon => icon.set_id === set.id).map(icon => [icon.subject_id, icon.svg])) }));
    const activeSetIds = new Set((sets.data ?? []).filter(set => !set.recycled_at).map(set => set.id));
    const recycledIcons = (icons.data ?? []).filter(icon => activeSetIds.has(icon.set_id) && icon.recycled_at).map(icon => {
      const set = (sets.data ?? []).find(item => item.id === icon.set_id);
      const subject = (set?.plan as { subjects?: Array<{ id: string; name: string }> } | null)?.subjects?.find(item => item.id === icon.subject_id);
      return { groupId: icon.set_id, subjectId: icon.subject_id, name: subject?.name ?? icon.subject_id, svg: icon.svg };
    });
    return Response.json({ groups: recycledGroups, icons: recycledIcons }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("RECYCLE_BIN_UNAVAILABLE", "Recycle bin is unavailable.", 503);
  }
}
