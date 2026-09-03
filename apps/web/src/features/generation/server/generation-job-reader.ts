import {
  generationJobResponseSchema,
  type GenerationJobV2,
} from "@icongen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type StoredAsset = { storage_bucket: string; storage_path: string };

type PresentableAsset = StoredAsset & {
  asset_role: string;
  format: "png" | "svg";
  size: number;
};

function assetsNeededForPresentation<T extends PresentableAsset>(
  assets: T[],
  groupBy: (asset: T) => string,
) {
  const groups = new Map<string, T[]>();
  for (const asset of assets)
    groups.set(groupBy(asset), [...(groups.get(groupBy(asset)) ?? []), asset]);
  return [...groups.values()].flatMap((group) => {
    const preview = group.find((asset) => asset.asset_role === "preview" && asset.format === "png")
      ?? group.find((asset) => asset.asset_role === "source" && asset.format === "png")
      ?? group.filter((asset) => asset.asset_role === "output" && asset.format === "png").sort((a, b) => b.size - a.size)[0];
    const vector = group.find((asset) => asset.asset_role === "output" && asset.format === "svg");
    return [preview, vector].filter((asset): asset is T => Boolean(asset));
  });
}

async function signStoredAssets<T extends StoredAsset>(
  client: SupabaseClient,
  assets: T[],
): Promise<Array<T & { previewUrl: string }>> {
  const byBucket = new Map<string, Array<{ asset: T; index: number }>>();
  assets.forEach((asset, index) => {
    const group = byBucket.get(asset.storage_bucket) ?? [];
    group.push({ asset, index });
    byBucket.set(asset.storage_bucket, group);
  });
  const signed = new Array<T & { previewUrl: string }>(assets.length);
  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, group]) => {
      const result = await client.storage
        .from(bucket)
        .createSignedUrls(
          group.map(({ asset }) => asset.storage_path),
          3600,
        );
      if (result.error) throw result.error;
      result.data.forEach((item, offset) => {
        if (!item.signedUrl)
          throw new Error("Generated icon preview URL was not returned");
        const { asset, index } = group[offset];
        signed[index] = { ...asset, previewUrl: item.signedUrl };
      });
    }),
  );
  return signed;
}

export async function readGenerationJob(
  client: SupabaseClient,
  userId: string,
  jobId: string,
  options: { includeAssets?: boolean; signer?: SupabaseClient } = {},
): Promise<GenerationJobV2 | null> {
  const includeAssets = options.includeAssets ?? true;
  const signer = options.signer ?? client;
  const [jobResult, subjectResult] = await Promise.all([
    client
      .from("generation_jobs")
      .select(
        "id,status,settings_version,skill_version,progress_percent,progress_phase,created_at,completed_at",
      )
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("generation_subjects")
      .select("id,client_id,name,description,position,status")
      .eq("job_id", jobId)
      .order("position"),
  ]);
  const { data: job, error: jobError } = jobResult;
  if (jobError) throw jobError;
  if (!job) return null;
  const { data: subjects, error: subjectError } = subjectResult;
  if (subjectError) throw subjectError;
  const subjectIds = (subjects ?? []).map((subject) => subject.id);
  let variants: Array<
    Record<string, unknown> & { active_revision_id: string | null }
  > = [];
  let supportsVariantEditing = true;
  if (subjectIds.length) {
    const variantResult = await client
      .from("generation_variants")
      .select(
        "id,subject_id,slot,status,is_primary,error_code,skill_version,image_model,active_revision_id",
      )
      .in("subject_id", subjectIds)
      .order("slot");
    if (variantResult.error?.code === "42703") {
      supportsVariantEditing = false;
      const legacy = await client
        .from("generation_variants")
        .select(
          "id,subject_id,slot,status,is_primary,error_code,skill_version,image_model",
        )
        .in("subject_id", subjectIds)
        .order("slot");
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
  const variantIds = (variants ?? []).map((variant) => variant.id);
  let assets: Array<{
    id: string;
    variant_id: string;
    asset_role: string;
    format: "png" | "svg";
    size: number;
    width: number;
    height: number;
    has_alpha: boolean;
    storage_bucket: string;
    storage_path: string;
  }> = [];
  if (variantIds.length && includeAssets) {
    const roleResult = await client
      .from("generation_assets")
      .select(
        "id,variant_id,asset_role,format,size,width,height,has_alpha,storage_bucket,storage_path",
      )
      .in("variant_id", variantIds)
      .order("size");
    if (roleResult.error?.code === "42703") {
      const legacyResult = await client
        .from("generation_assets")
        .select(
          "id,variant_id,asset_role,size,width,height,has_alpha,storage_bucket,storage_path",
        )
        .in("variant_id", variantIds)
        .order("size");
      if (legacyResult.error) throw legacyResult.error;
      assets = (legacyResult.data ?? []).map((asset) => ({
        ...asset,
        asset_role: asset.asset_role ?? "output",
        format: "png" as const,
      }));
    } else {
      if (roleResult.error) throw roleResult.error;
      assets = roleResult.data ?? [];
    }
  }

  const activeRevisionIds = includeAssets ? (variants ?? []).flatMap((variant) =>
    variant.active_revision_id ? [variant.active_revision_id] : [],
  ) : [];
  const revisionResult = activeRevisionIds.length
    ? await client
        .from("generation_variant_revisions")
        .select("id,assets")
        .in("id", activeRevisionIds)
        .eq("status", "completed")
    : { data: [], error: null };
  if (revisionResult.error) throw revisionResult.error;
  const revisionAssets = new Map<
    string,
    Array<(typeof assets)[number] & { previewUrl?: string }>
  >();
  const parsedRevisionAssets = (revisionResult.data ?? []).flatMap((revision) =>
    Array.isArray(revision.assets)
      ? revision.assets.map((asset) => ({
          revision_id: revision.id,
          id: String(asset.id),
          variant_id: "",
          asset_role: String(asset.assetRole),
          format: asset.format as "png" | "svg",
          size: Number(asset.size),
          width: Number(asset.width),
          height: Number(asset.height),
          has_alpha: Boolean(asset.hasAlpha),
          storage_bucket: String(asset.storageBucket),
          storage_path: String(asset.storagePath),
        }))
      : [],
  );
  const [signedRevisionPresentation, signedAssetPresentation] = await Promise.all([
    signStoredAssets(signer, assetsNeededForPresentation(parsedRevisionAssets, (asset) => asset.revision_id)),
    signStoredAssets(signer, assetsNeededForPresentation(assets ?? [], (asset) => asset.variant_id)),
  ]);
  const signedUrlByPath = new Map(
    [...signedRevisionPresentation, ...signedAssetPresentation].map((asset) => [
      `${asset.storage_bucket}:${asset.storage_path}`,
      asset.previewUrl,
    ]),
  );
  const signedRevisionAssets = parsedRevisionAssets.map((asset) => ({
    ...asset,
    previewUrl: signedUrlByPath.get(`${asset.storage_bucket}:${asset.storage_path}`),
  }));
  const assetRows = (assets ?? []).map((asset) => ({
    ...asset,
    previewUrl: signedUrlByPath.get(`${asset.storage_bucket}:${asset.storage_path}`),
  }));
  for (const asset of signedRevisionAssets) {
    const current = revisionAssets.get(asset.revision_id) ?? [];
    current.push(asset);
    revisionAssets.set(asset.revision_id, current);
  }
  const completedSubjects = (subjects ?? []).filter(
    (subject) => subject.status === "completed",
  ).length;
  const currentSubject = (subjects ?? []).find(
    (subject) => subject.status === "processing",
  );
  const firstVariant = (variants ?? [])[0];

  return generationJobResponseSchema.parse({
    id: job.id,
    supportsVariantEditing,
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
      variants: (variants ?? [])
        .filter((variant) => variant.subject_id === subject.id)
        .map((variant) => {
          const activeAssets = variant.active_revision_id
            ? revisionAssets.get(variant.active_revision_id)
            : undefined;
          const variantAssets =
            activeAssets ??
            assetRows.filter((asset) => asset.variant_id === variant.id);
          const previewAsset =
            variantAssets.find(
              (asset) =>
                asset.asset_role === "preview" && asset.format === "png",
            ) ??
            variantAssets.find(
              (asset) =>
                asset.asset_role === "source" && asset.format === "png",
            ) ??
            variantAssets
              .filter(
                (asset) =>
                  asset.asset_role === "output" && asset.format === "png",
              )
              .sort((a, b) => b.size - a.size)[0];
          const vectorAsset = variantAssets.find(
            (asset) => asset.asset_role === "output" && asset.format === "svg",
          );
          return {
            id: variant.id,
            slot: variant.slot,
            status: variant.status,
            isPrimary: variant.is_primary,
            previewUrl: previewAsset?.previewUrl,
            vectorUrl: vectorAsset?.previewUrl,
            activeRevisionId: activeAssets
              ? variant.active_revision_id
              : undefined,
            errorCode: variant.error_code ?? undefined,
            assets: variantAssets
              .filter((asset) => asset.asset_role === "output")
              .map((asset) => ({
                id: asset.id,
                assetRole: "output" as const,
                format: asset.format,
                size: asset.size,
                width: asset.width,
                height: asset.height,
                hasAlpha: asset.has_alpha,
                previewUrl: asset.previewUrl,
              })),
          };
        }),
    })),
    createdAt: new Date(job.created_at).toISOString(),
    completedAt: job.completed_at
      ? new Date(job.completed_at).toISOString()
      : undefined,
  });
}
