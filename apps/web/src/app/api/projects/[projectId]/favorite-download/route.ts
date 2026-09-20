import JSZip from "jszip";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ projectId: z.string().uuid() });
const subjectSchema = z.string().min(1).max(120);
type Context = { params: Promise<{ projectId: string }> };
const safeName = (value: unknown, fallback: string) => String(value || fallback).replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;

export async function GET(request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_PROJECT", "Invalid project.", 400);
  const url = new URL(request.url);
  const groupIds = [...new Set(url.searchParams.getAll("group"))].slice(0, 50);
  const iconPairs = [...new Set(url.searchParams.getAll("icon"))].slice(0, 100).flatMap(value => {
    const separator = value.indexOf(":");
    if (separator < 1) return [];
    const setId = z.string().uuid().safeParse(value.slice(0, separator));
    const subjectId = subjectSchema.safeParse(value.slice(separator + 1));
    return setId.success && subjectId.success ? [{ setId: setId.data, subjectId: subjectId.data }] : [];
  });
  const parsedGroups = z.array(z.string().uuid()).safeParse(groupIds);
  if (!parsedGroups.success || (!groupIds.length && !iconPairs.length))
    return apiError("INVALID_SELECTION", "Select at least one valid favorite.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const setIds = [...new Set([...groupIds, ...iconPairs.map(item => item.setId)])];
    const sets = await client.from("project_svg_icon_sets").select("id,plan,is_favorite")
      .eq("project_id", params.data.projectId).eq("user_id", user.id).in("id", setIds);
    if (sets.error) throw sets.error;
    const owned = new Map((sets.data ?? []).map(set => [set.id, set]));
    const allowedGroups = groupIds.filter(id => owned.get(id)?.is_favorite);
    const icons = await client.from("project_svg_icons").select("set_id,subject_id,svg,is_favorite,recycled_at")
      .in("set_id", [...owned.keys()]).is("recycled_at", null);
    if (icons.error) throw icons.error;
    const zip = new JSZip();
    let count = 0;
    allowedGroups.forEach(setId => {
      const set = owned.get(setId);
      const plan = set?.plan as { summary?: string; subjects?: Array<{ id?: string; name?: string }> } | null;
      const folder = zip.folder(`${safeName(plan?.summary, "icon-group")}-${setId.slice(0, 8)}`);
      (icons.data ?? []).filter(icon => icon.set_id === setId).forEach(icon => {
        const subject = plan?.subjects?.find(item => item.id === icon.subject_id);
        folder?.file(`${safeName(subject?.name, icon.subject_id)}.svg`, icon.svg);
        count += 1;
      });
    });
    iconPairs.forEach(pair => {
      if (!owned.has(pair.setId)) return;
      const icon = (icons.data ?? []).find(item => item.set_id === pair.setId && item.subject_id === pair.subjectId && item.is_favorite);
      if (!icon) return;
      const plan = owned.get(pair.setId)?.plan as { subjects?: Array<{ id?: string; name?: string }> } | null;
      const subject = plan?.subjects?.find(item => item.id === pair.subjectId);
      zip.file(`${safeName(subject?.name, pair.subjectId)}-${safeName(pair.subjectId, "icon")}.svg`, icon.svg);
      count += 1;
    });
    if (!count) return apiError("NO_FAVORITES", "No selected favorites are available to download.", 409);
    const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const buffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
    return new Response(buffer, { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="favorite-icons.zip"', "cache-control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("FAVORITE_EXPORT_FAILED", "Favorites could not be exported.", 503);
  }
}
