import JSZip from "jszip";
import { createGenerationDownloadSchema } from "@icongen/shared";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ jobId: z.string().uuid() });

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const params = paramsSchema.safeParse(await context.params);
  const body = createGenerationDownloadSchema.safeParse(await request.json().catch(() => null));
  if (!params.success || !body.success) return apiError("NO_RESULTS_SELECTED", "Select at least one valid icon result.", 400);
  try {
    const user = await requireActiveUser(); const client = await createServerSupabaseClient();
    const { data: job } = await client.from("generation_jobs").select("id").eq("id", params.data.jobId).eq("user_id", user.id).maybeSingle();
    if (!job) return apiError("GENERATION_JOB_NOT_FOUND", "The generation task was not found.", 404);
    const { data: subjects } = await client.from("generation_subjects").select("id,name").eq("job_id", job.id);
    const subjectIds = (subjects ?? []).map((subject) => subject.id);
    const { data: variants } = subjectIds.length ? await client.from("generation_variants").select("id,subject_id,slot").in("id", body.data.variantIds).in("subject_id", subjectIds).eq("status", "completed") : { data: [] };
    if ((variants ?? []).length !== body.data.variantIds.length) return apiError("RESOURCE_FORBIDDEN", "One or more selected results are unavailable.", 403);
    const variantIds = (variants ?? []).map((variant) => variant.id);
    const { data: assets, error } = await client.from("generation_assets").select("variant_id,storage_bucket,storage_path").in("variant_id", variantIds).eq("size", body.data.size);
    if (error) throw error;
    if ((assets ?? []).length !== variantIds.length) return apiError("DOWNLOAD_NOT_READY", "The selected size is not ready for every result.", 409);
    const zip = new JSZip();
    for (const variant of variants ?? []) {
      const asset = (assets ?? []).find((item) => item.variant_id === variant.id); if (!asset) continue;
      const file = await client.storage.from(asset.storage_bucket).download(asset.storage_path); if (file.error) throw file.error;
      const subject = (subjects ?? []).find((item) => item.id === variant.subject_id);
      zip.file(`${subject?.name ?? "icon"}-variant-${variant.slot}-${body.data.size}.png`, await file.data.arrayBuffer());
    }
    const archive = await zip.generateAsync({ type: "uint8array" });
    const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
    return new Response(archiveBuffer, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="bamboo-icongen-${job.id}.zip"`, "cache-control": "private, no-store" } });
  } catch (error) { return authErrorResponse(error) ?? apiError("DOWNLOAD_CREATE_FAILED", "We could not create the ZIP download.", 500); }
}
