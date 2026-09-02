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

const demoJobIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

const DEFAULT_PAGE_SIZE = 12;

type ListSubjectRow = { id: string; job_id: string; name: string; position: number };

async function readListPreviewUrls(client: SupabaseClient, subjects: ListSubjectRow[]) {
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
  for (let index = 0; index < subjectIds.length; index += 100) {
    const { data, error } = await client.from("generation_variants").select("id,subject_id,slot").in("subject_id", subjectIds.slice(index, index + 100)).eq("status", "completed").order("slot");
    if (error) throw error;
    variants.push(...((data ?? []) as typeof variants));
  }
  const assets: { id: string; variant_id: string; asset_role: string; format: string; size: number; storage_bucket: string; storage_path: string }[] = [];
  for (let index = 0; index < variants.length; index += 100) {
    const ids = variants.slice(index, index + 100).map((variant) => variant.id);
    const { data, error } = await client.from("generation_assets").select("id,variant_id,asset_role,format,size,storage_bucket,storage_path").in("variant_id", ids).eq("format", "png").order("size");
    if (error) throw error;
    assets.push(...((data ?? []) as typeof assets));
  }
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
  const signedUrlByAssetId = new Map<string, string>();
  const assetsByBucket = new Map<string, typeof selected>();
  for (const asset of [...selectedByJobId.values()].flat())
    assetsByBucket.set(asset.storage_bucket, [...(assetsByBucket.get(asset.storage_bucket) ?? []), asset]);
  await Promise.all([...assetsByBucket.entries()].map(async ([bucket, bucketAssets]) => {
    const { data, error } = await client.storage.from(bucket).createSignedUrls(bucketAssets.map((asset) => asset.storage_path), 3600);
    if (error) return;
    data.forEach((signed, index) => {
      if (signed.signedUrl) signedUrlByAssetId.set(bucketAssets[index].id, signed.signedUrl);
    });
  }));
  return new Map([...selectedByJobId.entries()].map(([jobId, jobAssets]) => [jobId, jobAssets.map((asset) => signedUrlByAssetId.get(asset.id)).filter((url): url is string => Boolean(url))]));
}

export async function readGenerationJobListItem(
  client: SupabaseClient,
  userId: string,
  jobId: string,
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
  const previews = await readListPreviewUrls(client, subjects);
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

export async function readGenerationJobs(client: SupabaseClient, userId: string, options: { page?: number; pageSize?: number; stylePreset?: IconStylePresetId; statusFilter?: GenerationJobStatusFilter; usageFilter?: GenerationJobUsageFilter; structureFilter?: GenerationJobStructureFilter } = {}): Promise<GenerationJobListPage> {
  const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.max(1, Math.min(48, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE)));
  let query = client.from("generation_jobs")
    .select("id,status,created_at,generation_spec", { count: "exact" }).eq("user_id", userId)
    .not("id", "in", `(${demoJobIds.join(",")})`)
    .order("created_at", { ascending: false });
  if (options.stylePreset) query = query.eq("generation_spec->style->>preset", options.stylePreset);
  else if (options.usageFilter === "interaction") query = query.eq("generation_spec->>purpose", "interaction");
  else if (options.usageFilter === "illustration") query = query.eq("generation_spec->>purpose", "app-icon");
  if (options.structureFilter) query = query.eq("generation_spec->style->>graphicStructure", options.structureFilter);
  if (options.statusFilter === "in-progress") query = query.in("status", ["queued", "processing"]);
  else if (options.statusFilter) query = query.eq("status", options.statusFilter);
  const from = (requestedPage - 1) * pageSize;
  const { data: jobs, error: jobsError, count } = await query.range(from, from + pageSize - 1);
  if (jobsError) throw jobsError;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (requestedPage > totalPages && total > 0) return readGenerationJobs(client, userId, { ...options, page: totalPages, pageSize });
  if (!jobs?.length) return { jobs: [], page: requestedPage, pageSize, total, totalPages };

  const { data: subjects, error: subjectsError } = await client.from("generation_subjects")
    .select("id,job_id,name,position").in("job_id", jobs.map((job) => job.id)).order("position", { ascending: true });
  if (subjectsError) throw subjectsError;
  const subjectRows = (subjects ?? []) as ListSubjectRow[];
  const previewUrls = await readListPreviewUrls(client, subjectRows);
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
