import JSZip from "jszip";
import { createGenerationDownloadSchema } from "@icongen/shared";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { serverLogger } from "@/lib/security/server-log";

const paramsSchema = z.object({ jobId: z.string().uuid() });
const MAX_ARCHIVE_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_SINGLE_ASSET_BYTES = 16 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  const body = createGenerationDownloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!params.success || !body.success)
    return apiError(
      "NO_RESULTS_SELECTED",
      "Select at least one valid icon result.",
      400,
    );
  try {
    const user = await requireActiveUser();
    const client = createAdminSupabaseClient();
    const { data: job } = await client
      .from("generation_jobs")
      .select("id,generation_spec")
      .eq("id", params.data.jobId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!job)
      return apiError(
        "GENERATION_JOB_NOT_FOUND",
        "The generation task was not found.",
        404,
      );
    const purpose =
      job.generation_spec &&
      typeof job.generation_spec === "object" &&
      "purpose" in job.generation_spec &&
      job.generation_spec.purpose === "app-icon"
        ? "app-icon"
        : "interaction";
    if (
      purpose === "app-icon" &&
      (body.data.format === "svg" || body.data.includeSvg)
    )
      return apiError(
        "SVG_NOT_SUPPORTED",
        "Illustration icons do not support SVG export.",
        400,
      );
    const { data: subjects } = await client
      .from("generation_subjects")
      .select("id,name")
      .eq("job_id", job.id);
    const subjectIds = (subjects ?? []).map((subject) => subject.id);
    let variants: Array<{
      id: string;
      subject_id: string;
      slot: number;
      active_revision_id: string | null;
    }> = [];
    if (subjectIds.length) {
      const variantResult = await client
        .from("generation_variants")
        .select("id,subject_id,slot,active_revision_id")
        .in("id", body.data.variantIds)
        .in("subject_id", subjectIds)
        .eq("status", "completed");
      if (variantResult.error?.code === "42703") {
        const legacy = await client
          .from("generation_variants")
          .select("id,subject_id,slot")
          .in("id", body.data.variantIds)
          .in("subject_id", subjectIds)
          .eq("status", "completed");
        if (legacy.error) throw legacy.error;
        variants = (legacy.data ?? []).map((variant) => ({
          ...variant,
          active_revision_id: null,
        }));
      } else {
        if (variantResult.error) throw variantResult.error;
        variants = variantResult.data ?? [];
      }
    }
    if ((variants ?? []).length !== body.data.variantIds.length)
      return apiError(
        "RESOURCE_FORBIDDEN",
        "One or more selected results are unavailable.",
        403,
      );
    const variantIds = (variants ?? []).map((variant) => variant.id);
    const resolvedAssets = await client
      .from("generation_assets")
      .select("variant_id,asset_role,format,size,storage_bucket,storage_path")
      .in("variant_id", variantIds);
    if (resolvedAssets.error) throw resolvedAssets.error;
    const activeRevisionIds = (variants ?? []).flatMap((variant) =>
      variant.active_revision_id ? [variant.active_revision_id] : [],
    );
    const revisions = activeRevisionIds.length
      ? await client
          .from("generation_variant_revisions")
          .select("id,variant_id,assets")
          .in("id", activeRevisionIds)
          .eq("status", "completed")
      : { data: [], error: null };
    if (revisions.error) throw revisions.error;
    const revisionAssets = new Map(
      (revisions.data ?? []).map((revision) => [
        revision.variant_id,
        Array.isArray(revision.assets)
          ? revision.assets.map((asset) => ({
              variant_id: revision.variant_id,
              asset_role: String(asset.assetRole),
              format: String(asset.format),
              size: Number(asset.size),
              storage_bucket: String(asset.storageBucket),
              storage_path: String(asset.storagePath),
            }))
          : [],
      ]),
    );
    const effectiveAssets = (variants ?? []).flatMap(
      (variant) =>
        revisionAssets.get(variant.id) ??
        (resolvedAssets.data ?? []).filter(
          (asset) => asset.variant_id === variant.id,
        ),
    );
    const assets = effectiveAssets.filter((asset) => {
      if (body.data.format === "svg")
        return asset.asset_role === "output" && asset.format === "svg";
      if (asset.format === "png" && asset.asset_role === "source") return true;
      if (asset.format === "png" && asset.asset_role === "output")
        return body.data.size ? asset.size === body.data.size : true;
      return (
        body.data.includeSvg &&
        asset.format === "svg" &&
        asset.asset_role === "output"
      );
    });
    const ready = variantIds.every((variantId) => {
      const variantAssets = assets.filter(
        (asset) => asset.variant_id === variantId,
      );
      if (body.data.format === "svg")
        return variantAssets.some((asset) => asset.format === "svg");
      const hasOriginal = variantAssets.some(
        (asset) => asset.format === "png" && asset.asset_role === "source",
      );
      const hasSizedPng = variantAssets.some(
        (asset) => asset.format === "png" && asset.asset_role === "output",
      );
      const hasRequestedSvg =
        !body.data.includeSvg ||
        variantAssets.some((asset) => asset.format === "svg");
      return hasOriginal && hasSizedPng && hasRequestedSvg;
    });
    if (!ready)
      return apiError(
        "DOWNLOAD_NOT_READY",
        "Some selected icon files are not ready. Wait for processing to finish or exclude SVG.",
        409,
      );
    const zip = new JSZip();
    let archiveInputBytes = 0;
    for (const variant of variants ?? []) {
      const subject = (subjects ?? []).find(
        (item) => item.id === variant.subject_id,
      );
      for (const asset of assets.filter(
        (item) => item.variant_id === variant.id,
      )) {
        const file = await client.storage
          .from(asset.storage_bucket)
          .download(asset.storage_path);
        if (file.error) throw file.error;
        if (file.data.size > MAX_SINGLE_ASSET_BYTES)
          return apiError(
            "DOWNLOAD_ASSET_TOO_LARGE",
            "One selected icon file is too large to package.",
            413,
          );
        archiveInputBytes += file.data.size;
        if (archiveInputBytes > MAX_ARCHIVE_INPUT_BYTES)
          return apiError(
            "DOWNLOAD_TOO_LARGE",
            "The selected files are too large to package together. Download fewer options.",
            413,
          );
        const suffix =
          asset.format === "svg"
            ? ""
            : asset.asset_role === "source"
              ? "-original"
              : `-${asset.size}`;
        zip.file(
          `${subject?.name ?? "icon"}-variant-${variant.slot}${suffix}.${asset.format}`,
          await file.data.arrayBuffer(),
        );
      }
    }
    const archive = await zip.generateAsync({ type: "uint8array" });
    const archiveBuffer = archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength,
    ) as ArrayBuffer;
    return new Response(archiveBuffer, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="easy-design-${job.id}.zip"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    serverLogger.error("generation_zip_create_failed", {
      jobId: params.success ? params.data.jobId : undefined,
      error,
    });
    return (
      authErrorResponse(error) ??
      apiError(
        "DOWNLOAD_CREATE_FAILED",
        "The download could not be prepared. Your icons are safe; try again.",
        500,
      )
    );
  }
}
