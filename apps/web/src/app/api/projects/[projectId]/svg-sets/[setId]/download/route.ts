import JSZip from "jszip";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ projectId: z.string().uuid(), setId: z.string().uuid() });
type Context = { params: Promise<{ projectId: string; setId: string }> };
const safeName = (value: unknown, fallback: string) => String(value || fallback).replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;

export async function GET(_request: Request, context: Context) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return apiError("INVALID_SET", "Invalid icon set.", 400);
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const set = await client.from("project_svg_icon_sets").select("id,plan").eq("id", params.data.setId).eq("project_id", params.data.projectId).eq("user_id", user.id).maybeSingle();
    if (set.error) throw set.error;
    if (!set.data) return apiError("SET_NOT_FOUND", "Icon set not found.", 404);
    const icons = await client.from("project_svg_icons").select("subject_id,svg").eq("set_id", params.data.setId).order("subject_id");
    if (icons.error) throw icons.error;
    if (!icons.data?.length) return apiError("NO_ICONS", "No generated icons are available to export.", 409);
    const subjects = Array.isArray(set.data.plan?.subjects) ? set.data.plan.subjects as Array<{ id?: string; name?: string }> : [];
    const zip = new JSZip();
    for (const icon of icons.data) {
      const subject = subjects.find(item => item.id === icon.subject_id);
      zip.file(`${safeName(subject?.name, icon.subject_id)}.svg`, icon.svg);
    }
    const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const buffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
    return new Response(buffer, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="icon-set-${params.data.setId}.zip"`, "cache-control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("EXPORT_FAILED", "Icon set export failed.", 503);
  }
}
