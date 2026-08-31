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
  previewAssetIds: string[];
};

export type GenerationJobListPage = { jobs: GenerationJobListItem[]; page: number; pageSize: number; total: number; totalPages: number };
export type GenerationJobStatusFilter = "in-progress" | "completed" | "partial" | "failed";
export type GenerationJobUsageFilter = "interaction" | "illustration";
export type GenerationJobStructureFilter = "linear" | "filled";
export type GenerationJobListPreload = { jobs: GenerationJobListItem[]; totals: Record<string, number>; pageSize: number };

const demoJobIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

const DEFAULT_PAGE_SIZE = 12;

type ListSubjectRow = { id: string; job_id: string; name: string; position: number };

async function readListPreviewAssetIds(client: SupabaseClient, subjects: ListSubjectRow[]) {
  const subjectIds = subjects.map((subject) => subject.id);
  if (!subjectIds.length) return new Map<string, string[]>();
  const variants: { id: string; subject_id: string; slot: number }[] = [];
  for (let index = 0; index < subjectIds.length; index += 100) {
    const { data, error } = await client.from("generation_variants").select("id,subject_id,slot").in("subject_id", subjectIds.slice(index, index + 100)).eq("status", "completed").order("slot");
    if (error) throw error;
    variants.push(...((data ?? []) as typeof variants));
  }
  const assets: { id: string; variant_id: string; asset_role: string; format: string; size: number }[] = [];
  for (let index = 0; index < variants.length; index += 100) {
    const ids = variants.slice(index, index + 100).map((variant) => variant.id);
    const { data, error } = await client.from("generation_assets").select("id,variant_id,asset_role,format,size").in("variant_id", ids).eq("format", "png").order("size");
    if (error) throw error;
    assets.push(...((data ?? []) as typeof assets));
  }
  const assetsByVariantId = new Map<string, typeof assets>();
  for (const asset of assets)
    assetsByVariantId.set(asset.variant_id, [
      ...(assetsByVariantId.get(asset.variant_id) ?? []),
      asset,
    ]);
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const selected = variants.map((variant) => {
    const candidates = assetsByVariantId.get(variant.id) ?? [];
    const asset = candidates.find((item) => item.asset_role === "preview") ?? candidates.find((item) => item.asset_role === "source") ?? candidates.filter((item) => item.asset_role === "output").sort((a, b) => b.size - a.size)[0];
    const subject = subjectById.get(variant.subject_id);
    return asset && subject ? { ...asset, jobId: subject.job_id, subjectPosition: subject.position, slot: variant.slot } : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((a, b) => a.subjectPosition - b.subjectPosition || a.slot - b.slot);
  const previewAssetIds = new Map<string, string[]>();
  for (const asset of selected) {
    const current = previewAssetIds.get(asset.jobId) ?? [];
    if (current.length < 3) previewAssetIds.set(asset.jobId, [...current, asset.id]);
  }
  return previewAssetIds;
}

export function generationJobFacetKey(style?: IconStylePresetId, status?: GenerationJobStatusFilter) {
  return `${style ?? "all"}:${status ?? "all"}`;
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

export function readPreloadedGenerationJobPage(preload: GenerationJobListPreload, style?: IconStylePresetId, status?: GenerationJobStatusFilter): GenerationJobListPage {
  const jobs = preload.jobs.filter((job) => (!style || job.stylePreset === style) && matchesGenerationJobStatus(job.status, status)).slice(0, preload.pageSize);
  const total = preload.totals[generationJobFacetKey(style, status)] ?? 0;
  return { jobs, page: 1, pageSize: preload.pageSize, total, totalPages: Math.max(1, Math.ceil(total / preload.pageSize)) };
}

export async function preloadGenerationJobFirstPages(client: SupabaseClient, userId: string, pageSize = DEFAULT_PAGE_SIZE): Promise<GenerationJobListPreload> {
  const rows: { id: string; status: GenerationJobStatusV2; created_at: string; generation_spec: unknown }[] = [];
  const batchSize = 1000;
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await client.from("generation_jobs").select("id,status,created_at,generation_spec")
      .eq("user_id", userId).not("id", "in", `(${demoJobIds.join(",")})`).order("created_at", { ascending: false }).range(from, from + batchSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as typeof rows;
    rows.push(...batch);
    if (batch.length < batchSize) break;
  }

  const totals: Record<string, number> = {};
  const keptCounts: Record<string, number> = {};
  const selectedIds = new Set<string>();
  for (const row of rows) {
    const style = parseStylePreset(row.generation_spec);
    const usage = parseGenerationJobUsage(row.generation_spec);
    const structure = parseGraphicStructure(row.generation_spec);
    const statusFilters: (GenerationJobStatusFilter | undefined)[] = [undefined, row.status === "queued" || row.status === "processing" ? "in-progress" : row.status as GenerationJobStatusFilter];
    const keys = statusFilters.flatMap((status) => [generationJobFacetKey(undefined, status), generationJobFacetKey(style, status), `usage:${usage}:${status ?? "all"}`, `structure:${structure}:${status ?? "all"}`, `usage:${usage}:structure:${structure}:${status ?? "all"}`]);
    for (const key of keys) {
      totals[key] = (totals[key] ?? 0) + 1;
      if ((keptCounts[key] ?? 0) < pageSize) selectedIds.add(row.id);
      keptCounts[key] = (keptCounts[key] ?? 0) + 1;
    }
  }

  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const subjects: ListSubjectRow[] = [];
  for (let index = 0; index < selectedRows.length; index += 100) {
    const ids = selectedRows.slice(index, index + 100).map((row) => row.id);
    const { data, error } = await client.from("generation_subjects").select("id,job_id,name,position").in("job_id", ids).order("position", { ascending: true });
    if (error) throw error;
    subjects.push(...((data ?? []) as typeof subjects));
  }
  const previewAssetIds = await readListPreviewAssetIds(client, subjects);
  const subjectsByJobId = new Map<string, ListSubjectRow[]>();
  for (const subject of subjects)
    subjectsByJobId.set(subject.job_id, [
      ...(subjectsByJobId.get(subject.job_id) ?? []),
      subject,
    ]);
  return {
    jobs: selectedRows.map((row) => ({ id: row.id, status: row.status, createdAt: new Date(row.created_at).toISOString(), stylePreset: parseStylePreset(row.generation_spec), usage: parseGenerationJobUsage(row.generation_spec), graphicStructure: parseGraphicStructure(row.generation_spec), subjects: (subjectsByJobId.get(row.id) ?? []).map((subject) => ({ name: subject.name, position: subject.position })), previewAssetIds: previewAssetIds.get(row.id) ?? [] })),
    totals,
    pageSize,
  };
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
  const previewAssetIds = await readListPreviewAssetIds(client, subjectRows);
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
      previewAssetIds: previewAssetIds.get(job.id) ?? [],
    })),
    page: requestedPage, pageSize, total, totalPages,
  };
}
