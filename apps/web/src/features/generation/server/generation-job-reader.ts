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
  const { data: assets, error: assetError } = variantIds.length
    ? await client.from("generation_assets").select("id,variant_id,size,width,height,has_alpha,storage_bucket,storage_path").in("variant_id", variantIds).order("size")
    : { data: [], error: null };
  if (assetError) throw assetError;

  const assetRows = await Promise.all((assets ?? []).map(async (asset) => {
    const signed = await client.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 3600);
    return { ...asset, previewUrl: signed.data?.signedUrl };
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
      variants: (variants ?? []).filter((variant) => variant.subject_id === subject.id).map((variant) => ({
        id: variant.id,
        slot: variant.slot,
        status: variant.status,
        isPrimary: variant.is_primary,
        errorCode: variant.error_code ?? undefined,
        assets: assetRows.filter((asset) => asset.variant_id === variant.id).map((asset) => ({
          id: asset.id, size: asset.size, width: asset.width, height: asset.height,
          hasAlpha: asset.has_alpha, previewUrl: asset.previewUrl,
        })),
      })),
    })),
    createdAt: job.created_at,
    completedAt: job.completed_at ?? undefined,
  });
}
