import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { iconPlanSchema, normalizeIconPlan } from "@/features/generation/icon-plan";

const paramsSchema = z.object({ projectId: z.string().uuid() });
type Context = { params: Promise<{ projectId: string }> };

const pageSchema = z.object({ offset: z.coerce.number().int().min(0).default(0), asOf: z.string().datetime().optional() });
const pageSize = 50;

export async function GET(request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiError("INVALID_PROJECT_ID", "Invalid project.", 400);
  const page = pageSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!page.success) return apiError("INVALID_PAGE", "Invalid icon set page.", 400);
  const asOf = page.data.asOf ?? new Date().toISOString();
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const project = await client.from("icon_projects").select("id").eq("id", parsed.data.projectId).eq("user_id", user.id).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) return apiError("PROJECT_NOT_FOUND", "Project not found.", 404);
    let sets = await client.from("project_svg_icon_sets").select("id,plan,snapshot,canvas_position,is_favorite,recycled_at,created_at").eq("project_id", parsed.data.projectId).eq("user_id", user.id).lte("created_at", asOf).order("created_at", { ascending: true }).order("id", { ascending: true }).range(page.data.offset, page.data.offset + pageSize - 1);
    if (sets.error?.code === "42703" || sets.error?.code === "PGRST204") {
      const legacy = await client.from("project_svg_icon_sets").select("id,plan,snapshot,created_at").eq("project_id", parsed.data.projectId).eq("user_id", user.id).lte("created_at", asOf).order("created_at", { ascending: true }).order("id", { ascending: true }).range(page.data.offset, page.data.offset + pageSize - 1);
      sets = { ...legacy, data: legacy.data?.map(set => ({ ...set, canvas_position: { x: 0, y: 0 }, is_favorite: false, recycled_at: null })) ?? null } as typeof sets;
    }
    if (sets.error) throw sets.error;
    const ids = (sets.data ?? []).map(set => set.id);
    const assets: Array<{ set_id: string; subject_id: string; svg: string; is_favorite?: boolean; recycled_at?: string | null }> = [];
    if (ids.length) {
      for (let offset = 0; ; offset += 1000) {
        let page = await client.from("project_svg_icons").select("set_id,subject_id,svg,is_favorite,recycled_at").in("set_id", ids)
          .order("set_id").order("subject_id").range(offset, offset + 999);
        if (page.error?.code === "42703" || page.error?.code === "PGRST204") {
          const legacy = await client.from("project_svg_icons").select("set_id,subject_id,svg").in("set_id", ids)
            .order("set_id").order("subject_id").range(offset, offset + 999);
          page = { ...legacy, data: legacy.data?.map(icon => ({ ...icon, is_favorite: false })) ?? null } as typeof page;
        }
        if (page.error) throw page.error;
        assets.push(...(page.data ?? []));
        if ((page.data?.length ?? 0) < 1000) break;
      }
    }
    const assetsBySet = new Map<string, typeof assets>();
    for (const asset of assets) {
      const group = assetsBySet.get(asset.set_id) ?? [];
      group.push(asset);
      assetsBySet.set(asset.set_id, group);
    }
    const items = (sets.data ?? []).map(set => {
      const groupAssets = assetsBySet.get(set.id) ?? [];
      return { id: set.id, plan: set.plan, snapshot: set.snapshot, position: set.canvas_position ?? { x: 0, y: 0 }, favorite: set.is_favorite ?? false, recycled: Boolean(set.recycled_at), saved: true,
        icons: Object.fromEntries(groupAssets.filter(asset => !asset.recycled_at).map(asset => [asset.subject_id, asset.svg])),
        favoriteIconIds: groupAssets.filter(asset => asset.is_favorite && !asset.recycled_at).map(asset => asset.subject_id),
        recycledIconIds: groupAssets.filter(asset => asset.recycled_at).map(asset => asset.subject_id) };
    });
    return Response.json({ items, nextOffset: (sets.data?.length ?? 0) === pageSize ? page.data.offset + pageSize : null, asOf }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error) ?? apiError("SVG_SETS_UNAVAILABLE", "Project icon sets unavailable.", 503); }
}

export async function POST(request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return apiError("INVALID_PROJECT_ID", "Invalid project.", 400);
  const body = await request.json().catch(() => null);
  const input = z.object({ plan: iconPlanSchema, snapshot: z.object({ projectId: z.string().uuid(), styleId: z.string().min(1).max(100), colors: z.unknown().optional(), theme: z.enum(["light", "dark"]).optional() }) }).safeParse(body);
  if (!input.success) return apiError("INVALID_INPUT", "Invalid icon set.", 400);
  if (input.data.snapshot.projectId !== parsed.data.projectId) return apiError("INVALID_PROJECT_ID", "Project mismatch.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const project = await client.from("icon_projects").select("id").eq("id", parsed.data.projectId).eq("user_id", user.id).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) return apiError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const plan = normalizeIconPlan(input.data.plan);
    const saved = await client.from("project_svg_icon_sets").insert({ project_id: parsed.data.projectId, user_id: user.id, plan, snapshot: input.data.snapshot }).select("id").single();
    if (saved.error) throw saved.error;
    return Response.json({ id: saved.data.id }, { status: 201 });
  } catch (error) { return authErrorResponse(error) ?? apiError("SVG_SET_SAVE_FAILED", "Icon set could not be saved.", 503); }
}
