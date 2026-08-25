import { generationJobResponseSchema, type GenerationJobV2 } from "@icongen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function readGenerationJob(client: SupabaseClient, userId: string, jobId: string): Promise<GenerationJobV2 | null> {
  const { data: job, error: jobError } = await client.from("generation_jobs")
    .select("id,status,settings_version,skill_version,progress_percent,progress_phase,created_at,completed_at")
    .eq("id", jobId).eq("user_id", userId).maybeSingle();
  if (jobError) throw jobError;
  if (!job) return null;

  const { data: subjects, error: subjectError } = await client.from("generation_subjects")
    .select("id,client_id,name,description,position,status")
    .eq("job_id", jobId).order("position");
  if (subjectError) throw subjectError;
  const subjectIds = (subjects ?? []).map((subject) => subject.id);
  const { data: variants, error: variantError } = subjectIds.length
    ? await client.from("generation_variants").select("id,subject_id,slot,status,is_primary,error_code,skill_version,image_model").in("subject_id", subjectIds).order("slot")
    : { data: [], error: null };
  if (variantError) throw variantError;
  const variantIds = (variants ?? []).map((variant) => variant.id);
  let assets: Array<{ id: string; variant_id: string; asset_role: string; size: number; width: number; height: number; has_alpha: boolean; storage_bucket: string; storage_path: string }> = [];
  if (variantIds.length) {
    const roleResult = await client.from("generation_assets").select("id,variant_id,asset_role,size,width,height,has_alpha,storage_bucket,storage_path").in("variant_id", variantIds).order("size");
    if (roleResult.error?.code === "42703") {
      const legacyResult = await client.from("generation_assets").select("id,variant_id,size,width,height,has_alpha,storage_bucket,storage_path").in("variant_id", variantIds).order("size");
      if (legacyResult.error) throw legacyResult.error;
      assets = (legacyResult.data ?? []).map((asset) => ({ ...asset, asset_role: "output" }));
    } else {
      if (roleResult.error) throw roleResult.error;
      assets = roleResult.data ?? [];
    }
  }

  const assetRows = await Promise.all((assets ?? []).map(async (asset) => {
    const signed = await client.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 3600);
    if (signed.error) throw new Error(`Failed to create generated icon preview URL: ${signed.error.message}`);
    return { ...asset, previewUrl: signed.data.signedUrl };
  }));
  const completedSubjects = (subjects ?? []).filter((subject) => subject.status === "completed").length;
  const currentSubject = (subjects ?? []).find((subject) => subject.status === "processing");
  const firstVariant = (variants ?? [])[0];

  return generationJobResponseSchema.parse({
    id: job.id,
    status: job.status,
    settingsVersion: job.settings_version,
    skillVersion: firstVariant?.skill_version ?? job.skill_version ?? undefined,
    model: firstVariant?.image_model ?? undefined,
    progress: {
      percent: job.progress_percent,
      phase: job.progress_phase,
      completedSubjects,
      totalSubjects: Math.max((subjects ?? []).length, 1),
      currentSubjectName: currentSubject?.name,
    },
    subjects: (subjects ?? []).map((subject) => ({
      id: subject.id,
      clientId: subject.client_id,
      name: subject.name,
      description: subject.description,
      position: subject.position,
      status: subject.status,
      variants: (variants ?? []).filter((variant) => variant.subject_id === subject.id).map((variant) => {
        const variantAssets = assetRows.filter((asset) => asset.variant_id === variant.id);
        const previewAsset = variantAssets.find((asset) => asset.asset_role === "preview")
          ?? variantAssets.find((asset) => asset.asset_role === "source")
          ?? variantAssets.filter((asset) => asset.asset_role === "output").sort((a, b) => b.size - a.size)[0];
        return {
          id: variant.id,
          slot: variant.slot,
          status: variant.status,
          isPrimary: variant.is_primary,
          previewUrl: previewAsset?.previewUrl,
          errorCode: variant.error_code ?? undefined,
          assets: variantAssets.filter((asset) => asset.asset_role === "output").map((asset) => ({
            id: asset.id, assetRole: "output" as const, size: asset.size, width: asset.width, height: asset.height,
            hasAlpha: asset.has_alpha, previewUrl: asset.previewUrl,
          })),
        };
      }),
    })),
    createdAt: new Date(job.created_at).toISOString(),
    completedAt: job.completed_at ? new Date(job.completed_at).toISOString() : undefined,
  });
}
