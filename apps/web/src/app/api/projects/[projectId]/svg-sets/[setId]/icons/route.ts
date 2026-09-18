import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateGeneratedSvg } from "@/features/generation/server/validate-generated-svg";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid() });
type Context = { params: Promise<{ projectId: string; setId: string }> };

export async function PUT(request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiError("INVALID_SET", "Invalid icon set.", 400);
  const body = z.object({ subjectId: z.string().min(1).max(80), svg: z.string().max(100_000) }).safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", "Invalid icon.", 400);
  let svg: string;
  try { svg = validateGeneratedSvg(body.data.svg); }
  catch { return apiError("INVALID_SVG", "Invalid SVG.", 400); }
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const set = await client.from("project_svg_icon_sets").select("plan").eq("id", parsed.data.setId).eq("project_id", parsed.data.projectId).eq("user_id", user.id).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    const subjects = set.data.plan?.subjects;
    if (!Array.isArray(subjects) || !subjects.some(subject => subject.id === body.data.subjectId)) return apiError("INVALID_SUBJECT", "Subject not found in set.", 400);
    const saved = await client.from("project_svg_icons").upsert({ set_id: parsed.data.setId, subject_id: body.data.subjectId, svg }, { onConflict: "set_id,subject_id" });
    if (saved.error) throw saved.error;
    return Response.json({ saved: true });
  } catch (error) { return authErrorResponse(error) ?? apiError("ICON_SAVE_FAILED", "Icon could not be saved.", 503); }
}
