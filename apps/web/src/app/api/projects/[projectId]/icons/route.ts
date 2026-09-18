import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ projectId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success)
    return apiError("INVALID_PROJECT_ID", "The project ID is invalid.", 400);

  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const project = await client
      .from("icon_projects")
      .select("id,name")
      .eq("id", parsed.data.projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (project.error) throw project.error;
    if (!project.data)
      return apiError("PROJECT_NOT_FOUND", "The project was not found.", 404);

    const { data, error } = await client
      .from("generation_jobs")
      .select("id,status,description,style_preset,subject_count,progress_percent,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("project_id", parsed.data.projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json(
      { project: project.data, items: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError("PROJECT_ICONS_UNAVAILABLE", "Project icons are unavailable.", 503)
    );
  }
}
