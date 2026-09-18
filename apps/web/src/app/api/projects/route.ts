import { z } from "zod";
import {
  iconProjectDescriptionSchema,
  iconProjectNameSchema,
  MAX_ICON_PROJECTS,
} from "@icongen/shared";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: iconProjectNameSchema,
  description: iconProjectDescriptionSchema,
});

export async function GET() {
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client
      .from("icon_projects")
      .select("id,name,description,theme,ai_theme,custom_theme,theme_status,theme_source,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return Response.json(
      { items: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError("PROJECTS_UNAVAILABLE", "Projects are unavailable.", 503)
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success)
    return apiError("INVALID_PROJECT", parsed.error.issues[0]?.message ?? "Invalid project name.", 400);

  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client
      .from("icon_projects")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description,
      })
      .select("id,name,description,theme,ai_theme,custom_theme,theme_status,theme_source,created_at,updated_at")
      .single();
    if (error?.code === "23505")
      return apiError("PROJECT_NAME_EXISTS", "A project with this name already exists.", 409);
    if (error?.message.includes("PROJECT_LIMIT_REACHED"))
      return apiError(
        "PROJECT_LIMIT_REACHED",
        `Each account can create up to ${MAX_ICON_PROJECTS} projects.`,
        409,
      );
    if (error?.message.includes("PROJECT_NAME_TOO_LONG"))
      return apiError("INVALID_PROJECT", "The project name is too long.", 400);
    if (error) throw error;
    return Response.json({ item: data }, { status: 201 });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      apiError("PROJECT_CREATE_FAILED", "The project could not be created.", 503)
    );
  }
}
