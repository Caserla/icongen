import { z } from "zod";
import { iconProjectDescriptionSchema, iconProjectNameSchema } from "@icongen/shared";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateProjectSchema = z.object({
  name: iconProjectNameSchema,
  description: iconProjectDescriptionSchema,
});

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success)
    return apiError("INVALID_PROJECT", parsed.error.issues[0]?.message ?? "Invalid project.", 400);
  try {
    const user = await requireActiveUser();
    const { projectId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
      return apiError("INVALID_PROJECT", "Invalid project ID.", 400);
    const client = await createServerSupabaseClient();
    const { data, error } = await client.from("icon_projects")
      .update({ name: parsed.data.name, description: parsed.data.description })
      .eq("id", projectId).eq("user_id", user.id)
      .select("id,name,description,theme,ai_theme,custom_theme,theme_status,theme_source,created_at,updated_at")
      .maybeSingle();
    if (error?.code === "23505")
      return apiError("PROJECT_NAME_EXISTS", "A project with this name already exists.", 409);
    if (error) throw error;
    if (!data) return apiError("PROJECT_NOT_FOUND", "Project not found.", 404);
    return Response.json({ item: data });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("PROJECT_UPDATE_FAILED", "Project could not be updated.", 503);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireActiveUser();
    const { projectId } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))
      return apiError("INVALID_PROJECT", "Invalid project ID.", 400);
    const client = await createServerSupabaseClient();
    const { data, error } = await client.from("icon_projects").delete()
      .eq("id", projectId).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return apiError("PROJECT_NOT_FOUND", "Project not found.", 404);
    return Response.json({ deleted: true });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("PROJECT_DELETE_FAILED", "Project could not be deleted.", 503);
  }
}
