import JSZip from "jszip";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { serverLogger } from "@/lib/security/server-log";

const bodySchema = z.object({ variantIds: z.array(z.string().uuid()).min(1).max(100) }).refine((value) => new Set(value.variantIds).size === value.variantIds.length);
const MAX_ARCHIVE_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 16 * 1024 * 1024;

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("NO_RESULTS_SELECTED", "Select at least one valid favorite.", 400);
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const { data: favorites, error: favoriteError } = await client
      .from("generation_favorites")
      .select("variant_id")
      .eq("user_id", user.id)
      .in("variant_id", body.data.variantIds);
    if (favoriteError) throw favoriteError;
    if ((favorites ?? []).length !== body.data.variantIds.length) return apiError("RESOURCE_FORBIDDEN", "One or more favorites are unavailable.", 403);
    const { data: variants, error: variantError } = await client
      .from("generation_variants")
      .select("id,subject_id,slot,active_revision_id")
      .in("id", body.data.variantIds)
      .eq("status", "completed");
    if (variantError) throw variantError;
    if ((variants ?? []).length !== body.data.variantIds.length) return apiError("DOWNLOAD_NOT_READY", "One or more favorites are not ready.", 409);
    const subjectIds = (variants ?? []).map((item) => item.subject_id);
    const { data: subjects, error: subjectError } = await client.from("generation_subjects").select("id,name").in("id", subjectIds);
    if (subjectError) throw subjectError;
    const activeRevisionIds = (variants ?? []).flatMap((item) => item.active_revision_id ? [item.active_revision_id] : []);
    const [{ data: baseAssets, error: assetError }, revisionResult] = await Promise.all([
      client.from("generation_assets").select("variant_id,asset_role,format,size,storage_bucket,storage_path").in("variant_id", body.data.variantIds),
      activeRevisionIds.length ? client.from("generation_variant_revisions").select("id,variant_id,assets").in("id", activeRevisionIds).eq("status", "completed") : Promise.resolve({ data: [], error: null }),
    ]);
    if (assetError) throw assetError;
    if (revisionResult.error) throw revisionResult.error;
    const revisions = new Map((revisionResult.data ?? []).map((revision) => [revision.variant_id, revision]));
    const zip = new JSZip();
    let totalBytes = 0;
    for (const variant of variants ?? []) {
      const revision = revisions.get(variant.id);
      const assets = revision && Array.isArray(revision.assets)
        ? revision.assets.map((asset) => ({ asset_role: String(asset.assetRole), format: String(asset.format), size: Number(asset.size), storage_bucket: String(asset.storageBucket), storage_path: String(asset.storagePath) }))
        : (baseAssets ?? []).filter((asset) => asset.variant_id === variant.id);
      const downloadable = assets.filter((asset) => asset.format === "png" && (asset.asset_role === "source" || asset.asset_role === "output"));
      if (!downloadable.some((asset) => asset.asset_role === "source") || !downloadable.some((asset) => asset.asset_role === "output")) return apiError("DOWNLOAD_NOT_READY", "Some favorite files are not ready.", 409);
      const subject = (subjects ?? []).find((item) => item.id === variant.subject_id);
      const safeName = (subject?.name ?? "icon").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80);
      for (const asset of downloadable) {
        const file = await client.storage.from(asset.storage_bucket).download(asset.storage_path);
        if (file.error) throw file.error;
        if (file.data.size > MAX_SINGLE_ASSET_BYTES) return apiError("DOWNLOAD_ASSET_TOO_LARGE", "One favorite is too large to package.", 413);
        totalBytes += file.data.size;
        if (totalBytes > MAX_ARCHIVE_INPUT_BYTES) return apiError("DOWNLOAD_TOO_LARGE", "Download fewer favorites at once.", 413);
        const suffix = asset.asset_role === "source" ? "original" : String(asset.size);
        zip.file(`${safeName}-variant-${variant.slot}-${suffix}.png`, await file.data.arrayBuffer());
      }
    }
    const archive = await zip.generateAsync({ type: "uint8array" });
    const buffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
    return new Response(buffer, { headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="easy-design-favorites.zip"', "cache-control": "private, no-store" } });
  } catch (error) {
    serverLogger.error("favorite_download_create_failed", { error });
    return authErrorResponse(error) ?? apiError("DOWNLOAD_CREATE_FAILED", "The favorite download could not be prepared.", 500);
  }
}
