import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config";
import { createDependencies } from "./dependencies";

const editId = process.argv[2];
if (!editId) throw new Error("Usage: npm run process-edit -- <edit-id>");

const config = loadConfig();
const dependencies = createDependencies(config);
const client = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

type RevisionAsset = {
  id: string;
  assetRole: "source" | "preview" | "output";
  format: "png" | "svg";
  size: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  storageBucket: string;
  storagePath: string;
};

async function upload(path: string, bytes: Uint8Array, contentType: string) {
  const result = await client.storage
    .from(config.SUPABASE_ICON_BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: true,
    });
  if (result.error)
    throw new Error(`Failed to store edited icon: ${result.error.message}`);
  return { bucket: config.SUPABASE_ICON_BUCKET, path };
}

async function run() {
  const revisionResult = await client
    .from("generation_variant_revisions")
    .select(
      "id,variant_id,parent_revision_id,revision_number,instruction,status",
    )
    .eq("id", editId)
    .maybeSingle();
  if (revisionResult.error) throw revisionResult.error;
  const revision = revisionResult.data;
  if (!revision) throw new Error(`Variant edit ${editId} was not found`);
  if (revision.status !== "queued") return;

  const variantResult = await client
    .from("generation_variants")
    .select("id,subject_id,slot,active_revision_id")
    .eq("id", revision.variant_id)
    .single();
  if (variantResult.error) throw variantResult.error;
  const variant = variantResult.data;
  const subjectResult = await client
    .from("generation_subjects")
    .select("id,job_id,name,description,position")
    .eq("id", variant.subject_id)
    .single();
  if (subjectResult.error) throw subjectResult.error;
  const subject = subjectResult.data;
  const job = await dependencies.repository.getJob(subject.job_id);
  if (!job) throw new Error(`Generation job ${subject.job_id} was not found`);
  const subjectRecord = job.subjects.find((item) => item.id === subject.id);
  if (!subjectRecord)
    throw new Error(`Generation subject ${subject.id} was not found`);

  const claimed = await client
    .from("generation_variant_revisions")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", editId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (claimed.error) throw claimed.error;
  if (!claimed.data) return;

  let sourceBucket: string;
  let sourcePath: string;
  if (revision.parent_revision_id) {
    const parent = await client
      .from("generation_variant_revisions")
      .select("source_bucket,source_path")
      .eq("id", revision.parent_revision_id)
      .single();
    if (parent.error) throw parent.error;
    sourceBucket = parent.data.source_bucket;
    sourcePath = parent.data.source_path;
  } else {
    const original = await client
      .from("generation_assets")
      .select("storage_bucket,storage_path")
      .eq("variant_id", variant.id)
      .eq("asset_role", "source")
      .eq("format", "png")
      .single();
    if (original.error) throw original.error;
    sourceBucket = original.data.storage_bucket;
    sourcePath = original.data.storage_path;
  }
  const sourceDownload = await client.storage
    .from(sourceBucket)
    .download(sourcePath);
  if (sourceDownload.error) throw sourceDownload.error;
  const sourceBytes = new Uint8Array(await sourceDownload.data.arrayBuffer());

  const effectiveBackground =
    subjectRecord.backgroundOverride ?? job.spec.background;
  const compiled = dependencies.promptCompiler.compile({
    purpose: job.spec.purpose,
    name: subjectRecord.name,
    description: subjectRecord.description,
    color: subjectRecord.colorOverride ?? job.spec.subjectColor,
    background: effectiveBackground,
    style: job.spec.style,
    sizes: job.spec.sizes,
    slot: variant.slot,
    iconSetConsistency: {
      enabled: job.spec.purpose === "interaction",
      subjectCount: job.subjects.length,
      targetOccupancyPercent: job.spec.style.subjectSizePercent,
      targetStrokeWidthPercent: job.spec.style.linearStrokeWidthPercent,
    },
  });
  const editPrompt = `${compiled.prompt}\n\nDETAIL EDIT\nEdit the supplied source icon, not the style-reference board. Apply only this requested change: ${revision.instruction}\nPreserve the subject identity, composition, canvas, optical size, stroke width, palette, background mode, background shape, corner radius, transparency and all unspecified details. Return exactly one square production icon. Do not redesign the icon and do not reproduce any reference grid.`;
  let image = await dependencies.imageProvider.generate({
    prompt: editPrompt,
    background: compiled.outputBackground,
    sourceImage: {
      bytes: sourceBytes,
      mimeType: "image/png",
      filename: "source-icon.png",
    },
    referenceImage: compiled.referenceImage,
  });
  if (
    compiled.outputBackground === "transparent" &&
    dependencies.imageProcessor.removeChromaBackground
  ) {
    image = await dependencies.imageProcessor.removeChromaBackground({
      bytes: image.bytes,
      color: { red: 0, green: 255, blue: 0 },
      tolerance: 72,
    });
  }
  const masked =
    job.spec.purpose === "app-icon" &&
    effectiveBackground.enabled &&
    effectiveBackground.container !== "square" &&
    dependencies.imageProcessor.applyRoundedMask
      ? await dependencies.imageProcessor.applyRoundedMask({
          bytes: image.bytes,
          cornerRadiusPercent:
            effectiveBackground.container === "circle"
              ? 50
              : (effectiveBackground.cornerRadius ?? 22),
        })
      : null;
  const finalBytes = masked?.bytes ?? image.bytes;
  const metadata =
    masked ??
    (await dependencies.imageProcessor.inspect({ bytes: finalBytes }));
  const base = `${job.id}/${subject.id}/variant-${variant.slot}/revisions/${editId}`;
  const assets: RevisionAsset[] = [];
  const source = await upload(`${base}/source.png`, finalBytes, "image/png");
  assets.push({
    id: crypto.randomUUID(),
    assetRole: "source",
    format: "png",
    size: Math.max(metadata.width, metadata.height),
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    storageBucket: source.bucket,
    storagePath: source.path,
  });

  const profile = job.spec.style.preset === "pixel-art" ? "pixel-art" : "icon";
  const previewImage = await dependencies.imageProcessor.process({
    bytes: finalBytes,
    size: 512,
    profile,
  });
  const preview = await upload(
    `${base}/preview.png`,
    previewImage.bytes,
    previewImage.mimeType,
  );
  assets.push({
    id: crypto.randomUUID(),
    assetRole: "preview",
    format: "png",
    size: 512,
    width: previewImage.width,
    height: previewImage.height,
    hasAlpha: previewImage.hasAlpha,
    storageBucket: preview.bucket,
    storagePath: preview.path,
  });
  for (const size of job.spec.sizes) {
    const output = await dependencies.imageProcessor.process({
      bytes: finalBytes,
      size,
      profile,
    });
    const stored = await upload(
      `${base}/${size}.png`,
      output.bytes,
      output.mimeType,
    );
    assets.push({
      id: crypto.randomUUID(),
      assetRole: "output",
      format: "png",
      size,
      width: output.width,
      height: output.height,
      hasAlpha: output.hasAlpha,
      storageBucket: stored.bucket,
      storagePath: stored.path,
    });
  }
  if (
    (job.spec.purpose === "interaction" ||
      job.spec.style.preset === "minimal-logo") &&
    dependencies.vectorImageProcessor
  ) {
    try {
      const vector = await dependencies.vectorImageProcessor.process({
        bytes: finalBytes,
        mode:
          job.spec.style.graphicStructure === "linear" ||
          job.spec.style.preset === "minimal-logo"
            ? "binary"
            : "color",
      });
      const stored = await upload(
        `${base}/output.svg`,
        vector.bytes,
        vector.mimeType,
      );
      assets.push({
        id: crypto.randomUUID(),
        assetRole: "output",
        format: "svg",
        size: Math.max(vector.width, vector.height),
        width: vector.width,
        height: vector.height,
        hasAlpha: true,
        storageBucket: stored.bucket,
        storagePath: stored.path,
      });
    } catch (error) {
      dependencies.logger.info(
        "Edited SVG derivation skipped; PNG assets remain available",
        {
          editId,
          error: error instanceof Error ? error.message : "Unknown SVG error",
        },
      );
    }
  }

  const current = await client
    .from("generation_variant_revisions")
    .select("status")
    .eq("id", editId)
    .single();
  if (current.error) throw current.error;
  if (current.data.status !== "processing") return;
  const completedAt = new Date().toISOString();
  const completed = await client
    .from("generation_variant_revisions")
    .update({
      status: "completed",
      source_bucket: source.bucket,
      source_path: source.path,
      preview_bucket: preview.bucket,
      preview_path: preview.path,
      assets,
      provider_request_id: image.providerRequestId ?? null,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", editId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (completed.error) throw completed.error;
  if (!completed.data) return;
  // Keep this completed revision as an unpublished draft. The current icon is
  // changed only after the user explicitly saves the result in the UI.
}

try {
  await run();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown variant edit error";
  dependencies.logger.error("Variant detail edit failed", {
    editId,
    error: message,
  });
  await client
    .from("generation_variant_revisions")
    .update({
      status: "failed",
      error_code: "VARIANT_EDIT_FAILED",
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", editId)
    .in("status", ["queued", "processing"]);
  process.exitCode = 1;
}
