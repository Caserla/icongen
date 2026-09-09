import { createClient } from "@supabase/supabase-js";
import { SharpImageProcessor } from "../services/icon-worker/src/adapters/sharp-image-processor";

const jobId = process.argv[2];
if (!jobId) throw new Error("Usage: rederive-job-raster-assets.ts <job-id>");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedProjectRef = process.env.LOCAL_GENERATION_SUPABASE_PROJECT_REF;
const environment = process.env.SUPABASE_ENVIRONMENT;
if (!supabaseUrl || !serviceRoleKey || !expectedProjectRef)
  throw new Error("Local Supabase environment is incomplete");
if (environment !== "development")
  throw new Error(`Refusing to rederive assets outside development (received ${environment ?? "unset"})`);
const actualProjectRef = new URL(supabaseUrl).hostname.split(".")[0];
if (actualProjectRef !== expectedProjectRef)
  throw new Error(`Supabase project mismatch: expected ${expectedProjectRef}, received ${actualProjectRef}`);

async function main() {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const processor = new SharpImageProcessor();

const { data: subjects, error: subjectsError } = await client
  .from("generation_subjects")
  .select("id")
  .eq("job_id", jobId);
if (subjectsError) throw subjectsError;
const subjectIds = subjects?.map((subject) => subject.id) ?? [];
if (!subjectIds.length) throw new Error(`No subjects found for ${jobId}`);

const { data: variants, error: variantsError } = await client
  .from("generation_variants")
  .select("id,slot")
  .in("subject_id", subjectIds)
  .order("slot");
if (variantsError) throw variantsError;
if (!variants?.length) throw new Error(`No variants found for ${jobId}`);

let updated = 0;
for (const variant of variants) {
  const { data: assets, error: assetsError } = await client
    .from("generation_assets")
    .select("id,asset_role,format,size,storage_bucket,storage_path")
    .eq("variant_id", variant.id)
    .eq("format", "png");
  if (assetsError) throw assetsError;
  const source = assets?.find((asset) => asset.asset_role === "source");
  const outputs = assets?.filter((asset) => asset.asset_role === "output") ?? [];
  if (!source) throw new Error(`Variant ${variant.slot} is missing its source asset`);
  const { data: sourceBlob, error: sourceError } = await client.storage
    .from(source.storage_bucket)
    .download(source.storage_path);
  if (sourceError) throw sourceError;
  const sourceBytes = new Uint8Array(await sourceBlob.arrayBuffer());

  for (const asset of outputs) {
    const result = await processor.process({
      bytes: sourceBytes,
      size: asset.size,
      profile: "icon",
    });
    const { error: uploadError } = await client.storage
      .from(asset.storage_bucket)
      .upload(asset.storage_path, result.bytes, {
        contentType: result.mimeType,
        cacheControl: "0",
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const { error: updateError } = await client
      .from("generation_assets")
      .update({
        width: result.width,
        height: result.height,
        has_alpha: result.hasAlpha,
      })
      .eq("id", asset.id);
    if (updateError) throw updateError;
    updated += 1;
    console.log(`variant ${variant.slot}: ${asset.size}px`);
  }
}

  console.log(`Updated ${updated} raster derivatives in development project ${expectedProjectRef}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
