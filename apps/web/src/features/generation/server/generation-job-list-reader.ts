import { ICON_STYLE_PRESET_IDS, type GenerationJobStatusV2, type IconStylePresetId } from "@icongen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerationJobListItem = {
  id: string;
  status: GenerationJobStatusV2;
  createdAt: string;
  stylePreset: IconStylePresetId;
  usage: GenerationJobUsageFilter;
  graphicStructure: "linear" | "filled";
  subjects: { name: string; position: number }[];
  previewUrls: string[];
};

export type GenerationJobListPage = { jobs: GenerationJobListItem[]; page: number; pageSize: number; total: number; totalPages: number };
export type GenerationJobStatusFilter = "in-progress" | "completed" | "partial" | "failed";
export type GenerationJobUsageFilter = "interaction" | "illustration";
export type GenerationJobStructureFilter = "linear" | "filled";
export type GenerationJobListTimings = Partial<Record<"jobs" | "subjects" | "variants" | "assets" | "signing", number>>;

const demoJobIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

const DEFAULT_PAGE_SIZE = 12;
const SIGNED_PREVIEW_TTL_MS = 8 * 60_000;
const MAX_SIGNED_PREVIEW_CACHE_ENTRIES = 2_000;
const signedPreviewCache = new Map<string, { url: string; expiresAt: number }>();

export function readCachedGeneratedAssetUrl(bucket: string, path: string) {
  const key = `${bucket}:${path}`;
  const cached = signedPreviewCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    signedPreviewCache.delete(key);
    return undefined;
  }
  return cached.url;
}

export function cacheGeneratedAssetUrl(bucket: string, path: string, url: string) {
  signedPreviewCache.set(`${bucket}:${path}`, {
    url,
    expiresAt: Date.now() + SIGNED_PREVIEW_TTL_MS,
  });
}

type ListSubjectRow = { id: string; job_id: string; name: string; position: number };
type ListAssetRow = { id: string; variant_id: string; asset_role: string; format: string; size: number; storage_bucket: string; storage_path: string };

export function chooseListThumbnail<T extends { size: number }>(candidates: T[]) {
  return [...candidates].sort((a, b) => {
    const aOversized = a.size > 256;
    const bOversized = b.size > 256;
    if (aOversized !== bOversized) return aOversized ? 1 : -1;
    return aOversized ? a.size - b.size : b.size - a.size;
  })[0];
}

async function readPreferredListAssets(client: SupabaseClient, variantIds: string[], timings?: GenerationJobListTimings) {
  const startedAt = performance.now();
  const assets: ListAssetRow[] = [];
  let missing = new Set(variantIds);
  for (const role of ["preview", "source", "output"] as const) {
    if (!missing.size) break;
    const unresolved = [...missing];
    const found: ListAssetRow[] = [];
    for (let index = 0; index < unresolved.length; index += 100) {
      const { data, error } = await client.from("generation_assets")
        .select("id,variant_id,asset_role,format,size,storage_bucket,storage_path")
        .in("variant_id", unresolved.slice(index, index + 100))
        .eq("format", "png")
        .eq("asset_role", role)
        .order("size", { ascending: false });
      if (error) throw error;
      found.push(...((data ?? []) as ListAssetRow[]));
    }
    const candidatesByVariant = new Map<string, ListAssetRow[]>();
    for (const asset of found)
      candidatesByVariant.set(asset.variant_id, [
        ...(candidatesByVariant.get(asset.variant_id) ?? []),
        asset,
      ]);
    const bestByVariant = new Map<string, ListAssetRow>();
    for (const [variantId, candidates] of candidatesByVariant) {
      // Library cards never need the largest generated PNG. Prefer the 256px
      // derivative, then the largest smaller derivative, and only fall back to
      // the smallest oversized file when legacy data has no thumbnail.
      const best = chooseListThumbnail(candidates);
      if (best) bestByVariant.set(variantId, best);
    }
    assets.push(...bestByVariant.values());
    missing = new Set(unresolved.filter((variantId) => !bestByVariant.has(variantId)));
  }
  if (timings) timings.assets = Math.round(performance.now() - startedAt);
  return assets;
}

async function readListPreviewUrls(client: SupabaseClient, signer: SupabaseClient, subjects: ListSubjectRow[], timings?: GenerationJobListTimings) {
  const previewSubjects: ListSubjectRow[] = [];
  const countsByJobId = new Map<string, number>();
  for (const subject of subjects) {
    const count = countsByJobId.get(subject.job_id) ?? 0;
    if (count < 3) previewSubjects.push(subject);
    countsByJobId.set(subject.job_id, count + 1);
  }
  const subjectIds = previewSubjects.map((subject) => subject.id);
  if (!subjectIds.length) return new Map<string, string[]>();
  const variants: { id: string; subject_id: string; slot: number }[] = [];
  const variantsStartedAt = performance.now();
  for (let index = 0; index < subjectIds.length; index += 100) {
    const { data, error } = await client.from("generation_variants").select("id,subject_id,slot").in("subject_id", subjectIds.slice(index, index + 100)).eq("status", "completed").order("slot");
    if (error) throw error;
    variants.push(...((data ?? []) as typeof variants));
  }
  if (timings) timings.variants = Math.round(performance.now() - variantsStartedAt);
  const assets = await readPreferredListAssets(client, variants.map((variant) => variant.id), timings);
  const assetsByVariantId = new Map<string, typeof assets>();
  for (const asset of assets)
    assetsByVariantId.set(asset.variant_id, [
      ...(assetsByVariantId.get(asset.variant_id) ?? []),
      asset,
    ]);
  const subjectById = new Map(previewSubjects.map((subject) => [subject.id, subject]));
  const selected = variants.map((variant) => {
    const candidates = assetsByVariantId.get(variant.id) ?? [];
    const asset = candidates.find((item) => item.asset_role === "preview") ?? candidates.find((item) => item.asset_role === "source") ?? candidates.filter((item) => item.asset_role === "output").sort((a, b) => b.size - a.size)[0];
    const subject = subjectById.get(variant.subject_id);
    return asset && subject ? { ...asset, jobId: subject.job_id, subjectPosition: subject.position, slot: variant.slot } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => a.subjectPosition - b.subjectPosition || a.slot - b.slot);
  const selectedByJobId = new Map<string, typeof selected>();
  for (const asset of selected) {
    const current = selectedByJobId.get(asset.jobId) ?? [];
    if (current.length < 3) selectedByJobId.set(asset.jobId, [...current, asset]);
  }
  // Signing every thumbnail through its own API request caused an N+1 chain:
  // auth + asset lookup + signing + redirect for as many as 36 images/page.
  // The list query already proves ownership, so sign the page's selected assets
  // in one call per bucket. Short expiry limits exposure; the authenticated
  // per-asset endpoint remains the fallback when a batch cannot be signed.
  const signedUrlByAssetId = new Map<string, string>();
  const assetsByBucket = new Map<string, typeof selected>();
  const now = Date.now();
  for (const asset of [...selectedByJobId.values()].flat()) {
    const cacheKey = `${asset.storage_bucket}:${asset.storage_path}`;
    const cached = signedPreviewCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      signedUrlByAssetId.set(asset.id, cached.url);
      continue;
    }
    if (cached) signedPreviewCache.delete(cacheKey);
    assetsByBucket.set(asset.storage_bucket, [...(assetsByBucket.get(asset.storage_bucket) ?? []), asset]);
  }
  const signingStartedAt = performance.now();
  await Promise.all(
    [...assetsByBucket.entries()].map(async ([bucket, bucketAssets]) => {
      const { data, error } = await signer.storage
        .from(bucket)
        .createSignedUrls(
          bucketAssets.map((asset) => asset.storage_path),
          600,
        );
      if (error) return;
      data.forEach((signed, index) => {
        if (signed.signedUrl) {
          signedUrlByAssetId.set(bucketAssets[index].id, signed.signedUrl);
          signedPreviewCache.set(`${bucket}:${bucketAssets[index].storage_path}`, {
            url: signed.signedUrl,
            expiresAt: now + SIGNED_PREVIEW_TTL_MS,
          });
        }
      });
    }),
  );
  if (signedPreviewCache.size > MAX_SIGNED_PREVIEW_CACHE_ENTRIES) {
    for (const key of signedPreviewCache.keys()) {
      signedPreviewCache.delete(key);
      if (signedPreviewCache.size <= MAX_SIGNED_PREVIEW_CACHE_ENTRIES) break;
    }
  }
  if (timings) timings.signing = Math.round(performance.now() - signingStartedAt);
  return new Map(
    [...selectedByJobId.entries()].map(([jobId, jobAssets]) => [
      jobId,
      jobAssets.map(
        (asset) =>
          signedUrlByAssetId.get(asset.id) ??
          new URL(
            `/api/generation/assets/${asset.id}/preview`,
            process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000",
          ).toString(),
      ),
    ]),
  );
}

export async function readGenerationJobListItem(
  client: SupabaseClient,
  userId: string,
  jobId: string,
  signer: SupabaseClient = client,
): Promise<GenerationJobListItem | null> {
  const { data: job, error } = await client.from("generation_jobs")
    .select("id,status,created_at,generation_spec")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!job) return null;
  const { data, error: subjectsError } = await client.from("generation_subjects")
    .select("id,job_id,name,position")
    .eq("job_id", jobId)
    .order("position", { ascending: true });
  if (subjectsError) throw subjectsError;
  const subjects = (data ?? []) as ListSubjectRow[];
  const previews = await readListPreviewUrls(client, signer, subjects);
  return {
    id: job.id,
    status: job.status as GenerationJobStatusV2,
    createdAt: new Date(job.created_at).toISOString(),
    stylePreset: parseStylePreset(job.generation_spec),
    usage: parseGenerationJobUsage(job.generation_spec),
    graphicStructure: parseGraphicStructure(job.generation_spec),
    subjects: subjects.map((subject) => ({ name: subject.name, position: subject.position })),
    previewUrls: previews.get(job.id) ?? [],
  };
}

export function matchesGenerationJobStatus(status: GenerationJobStatusV2, filter?: GenerationJobStatusFilter) {
  return !filter || (filter === "in-progress" ? status === "queued" || status === "processing" : status === filter);
}

export function parseStylePreset(spec: unknown): IconStylePresetId {
  const preset = typeof spec === "object" && spec !== null && "style" in spec
    && typeof spec.style === "object" && spec.style !== null && "preset" in spec.style ? spec.style.preset : undefined;
  return typeof preset === "string" && ICON_STYLE_PRESET_IDS.includes(preset as IconStylePresetId) ? preset as IconStylePresetId : "line-icon";
}

export function parseGraphicStructure(spec: unknown): GenerationJobStructureFilter {
  const structure = typeof spec === "object" && spec !== null && "style" in spec
    && typeof spec.style === "object" && spec.style !== null && "graphicStructure" in spec.style ? spec.style.graphicStructure : undefined;
  return structure === "filled" ? "filled" : "linear";
}

export function parseGenerationJobUsage(spec: unknown): GenerationJobUsageFilter {
  const purpose = typeof spec === "object" && spec !== null && "purpose" in spec ? spec.purpose : undefined;
  if (purpose === "interaction") return "interaction";
  if (purpose === "app-icon") return "illustration";
  return parseStylePreset(spec) === "line-icon" ? "interaction" : "illustration";
}

export async function readGenerationJobsRpc(
  client: SupabaseClient,
  signer: SupabaseClient,
  options: { page: number; usage: GenerationJobUsageFilter; style?: IconStylePresetId; structure?: GenerationJobStructureFilter; status?: GenerationJobStatusFilter },
): Promise<GenerationJobListPage> {
  const pageSize = DEFAULT_PAGE_SIZE;
  const { data, error } = await client.rpc("list_generation_jobs_v1", {
    p_page: options.page,
    p_page_size: pageSize,
    p_usage: options.usage,
    p_style: options.style ?? null,
    p_structure: options.structure ?? null,
    p_status: options.status ?? null,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string; status: GenerationJobStatusV2; created_at: string; generation_spec: unknown; total_count: number;
    subjects: Array<{ name: string; position: number }>;
    preview_assets: ListAssetRow[];
  }>;
  const allAssets = rows.flatMap((row) => row.preview_assets ?? []);
  const urls = new Map<string, string>();
  const byBucket = new Map<string, ListAssetRow[]>();
  const now = Date.now();
  for (const asset of allAssets) {
    const key = `${asset.storage_bucket}:${asset.storage_path}`;
    const cached = signedPreviewCache.get(key);
    if (cached && cached.expiresAt > now) urls.set(asset.id, cached.url);
    else byBucket.set(asset.storage_bucket, [...(byBucket.get(asset.storage_bucket) ?? []), asset]);
  }
  await Promise.all([...byBucket.entries()].map(async ([bucket, assets]) => {
    const signed = await signer.storage.from(bucket).createSignedUrls(assets.map((asset) => asset.storage_path), 600);
    if (signed.error) return;
    signed.data.forEach((entry, index) => {
      if (!entry.signedUrl) return;
      urls.set(assets[index].id, entry.signedUrl);
      signedPreviewCache.set(`${bucket}:${assets[index].storage_path}`, { url: entry.signedUrl, expiresAt: now + SIGNED_PREVIEW_TTL_MS });
    });
  }));
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    jobs: rows.map((row) => ({
      id: row.id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      stylePreset: parseStylePreset(row.generation_spec),
      usage: parseGenerationJobUsage(row.generation_spec),
      graphicStructure: parseGraphicStructure(row.generation_spec),
      subjects: row.subjects ?? [],
      previewUrls: (row.preview_assets ?? []).map((asset) => urls.get(asset.id)).filter((url): url is string => Boolean(url)),
    })),
    page: options.page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function readGenerationJobs(client: SupabaseClient, userId: string, options: { page?: number; pageSize?: number; stylePreset?: IconStylePresetId; statusFilter?: GenerationJobStatusFilter; usageFilter?: GenerationJobUsageFilter; structureFilter?: GenerationJobStructureFilter } = {}, signer: SupabaseClient = client, timings?: GenerationJobListTimings): Promise<GenerationJobListPage> {
  const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.max(1, Math.min(48, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  let query = client.from("generation_jobs")
    .select("id,status,created_at,generation_spec", { count: "exact" }).eq("user_id", userId)
    .not("id", "in", `(${demoJobIds.join(",")})`)
    .order("created_at", { ascending: false });
  if (options.usageFilter === "interaction") query = query.eq("generation_spec->>purpose", "interaction");
  else if (options.usageFilter === "illustration") query = query.eq("generation_spec->>purpose", "app-icon");
  if (options.stylePreset) query = query.eq("generation_spec->style->>preset", options.stylePreset);
  if (options.structureFilter) query = query.eq("generation_spec->style->>graphicStructure", options.structureFilter);
  if (options.statusFilter === "in-progress") query = query.in("status", ["queued", "processing"]);
  else if (options.statusFilter) query = query.eq("status", options.statusFilter);
  const from = (requestedPage - 1) * pageSize;
  const jobsStartedAt = performance.now();
  const { data: jobs, error: jobsError, count } = await query.range(from, from + pageSize - 1);
  if (timings) timings.jobs = Math.round(performance.now() - jobsStartedAt);
  if (jobsError) throw jobsError;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (requestedPage > totalPages && total > 0) return readGenerationJobs(client, userId, { ...options, page: totalPages, pageSize }, signer, timings);
  if (!jobs?.length) return { jobs: [], page: requestedPage, pageSize, total, totalPages };

  const subjectsStartedAt = performance.now();
  const { data: subjects, error: subjectsError } = await client.from("generation_subjects")
    .select("id,job_id,name,position").in("job_id", jobs.map((job) => job.id)).order("position", { ascending: true });
  if (timings) timings.subjects = Math.round(performance.now() - subjectsStartedAt);
  if (subjectsError) throw subjectsError;
  const subjectRows = (subjects ?? []) as ListSubjectRow[];
  const previewUrls = await readListPreviewUrls(client, signer, subjectRows, timings);
  const subjectsByJobId = new Map<string, ListSubjectRow[]>();
  for (const subject of subjectRows)
    subjectsByJobId.set(subject.job_id, [
      ...(subjectsByJobId.get(subject.job_id) ?? []),
      subject,
    ]);

  return {
    jobs: jobs.map((job) => ({
      id: job.id, status: job.status as GenerationJobStatusV2, createdAt: new Date(job.created_at).toISOString(),
      stylePreset: parseStylePreset(job.generation_spec), usage: parseGenerationJobUsage(job.generation_spec), graphicStructure: parseGraphicStructure(job.generation_spec),
      subjects: (subjectsByJobId.get(job.id) ?? []).map((subject) => ({ name: subject.name, position: subject.position })),
      previewUrls: previewUrls.get(job.id) ?? [],
    })),
    page: requestedPage, pageSize, total, totalPages,
  };
}
