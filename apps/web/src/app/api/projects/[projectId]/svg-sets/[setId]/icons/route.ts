import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { iconSaveSchema, prepareIconSave } from "@/features/generation/server/icon-save-contract";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid() });
type Context = { params: Promise<{ projectId: string; setId: string }> };

export async function PUT(request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiError("INVALID_SET", "Invalid icon set.", 400);
  const body = iconSaveSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("INVALID_INPUT", "Invalid icon.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const set = await client.from("project_svg_icon_sets").select("plan").eq("id", parsed.data.setId).eq("project_id", parsed.data.projectId).eq("user_id", user.id).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    const subjects = set.data.plan?.subjects;
    if (!Array.isArray(subjects)) return apiError("INVALID_SUBJECT", "Invalid saved plan.", 400);
    let rows;
    try { rows = prepareIconSave(body.data, subjects); }
    catch (error) { return apiError("INVALID_ICON_RESULT", error instanceof Error ? error.message : "Invalid icon result", 400); }
    // A single PostgreSQL statement commits both states or neither state.
    let contextSaved = rows.some(row => row.generation_context);
    let saved = await client.from("project_svg_icons").upsert(rows.map(row => ({ ...row, set_id: parsed.data.setId })), { onConflict: "set_id,subject_id" });
    // Six-style families live in style_variants. Never silently fall back
    // to a Linear-only row when the database has not received migration 0047.
    if (rows.some(row => row.style_variants) && ["42703", "PGRST204"].includes(saved.error?.code ?? "")) {
      return apiError("STYLE_FAMILY_STORAGE_UNAVAILABLE", "Six-style storage is unavailable; no icon was saved.", 503);
    }
    // Rolling deployments must not discard good SVGs when migration 0046 is pending.
    // Expose the missing provenance write instead of claiming it was persisted.
    if (contextSaved && !rows.some(row => row.style_variants) && ["42703", "PGRST204"].includes(saved.error?.code ?? "") && saved.error?.message.includes("generation_context")) {
      contextSaved = false;
      saved = await client.from("project_svg_icons").upsert(rows.map(row => ({ set_id: parsed.data.setId, subject_id: row.subject_id, svg: row.svg })), { onConflict: "set_id,subject_id" });
    }
    if (saved.error) throw saved.error;
    return Response.json({ saved: true, generationContextSaved: contextSaved });
  } catch (error) { return authErrorResponse(error) ?? apiError("ICON_SAVE_FAILED", "Icon could not be saved.", 503); }
}
