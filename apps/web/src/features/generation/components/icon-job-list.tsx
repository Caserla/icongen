"use client";

import Link from "next/link";
import { useReducer } from "react";
import { ICON_STYLE_PRESETS, type IconStylePresetId } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { GeneratedIconPreview } from "@/features/generation/components/generated-icon-preview";
import { reduceIconJobFilters } from "@/features/generation/icon-job-filters";
import type { GenerationJobListItem, GenerationJobListPage, GenerationJobListPreload, GenerationJobStatusFilter, GenerationJobStructureFilter, GenerationJobUsageFilter } from "@/features/generation/server/generation-job-list-reader";

const statusOptions: { id?: GenerationJobStatusFilter; label: { zh: string; en: string } }[] = [
  { label: { zh: "全部状态", en: "All statuses" } },
  { id: "in-progress", label: { zh: "生成中", en: "In progress" } },
  { id: "completed", label: { zh: "已完成", en: "Completed" } },
  { id: "partial", label: { zh: "部分完成", en: "Partially completed" } },
  { id: "failed", label: { zh: "生成失败", en: "Failed" } },
];

const usageOptions: { id: GenerationJobUsageFilter; label: { zh: string; en: string } }[] = [
  { id: "interaction", label: { zh: "App 交互图标", en: "App UI icons" } },
  { id: "illustration", label: { zh: "App 插画图标", en: "App illustration icons" } },
];
const structureOptions: { id: GenerationJobStructureFilter; label: { zh: string; en: string }; description: { zh: string; en: string } }[] = [
  { id: "linear", label: { zh: "线性图标", en: "Line icons" }, description: { zh: "使用统一线条构成的清晰交互图标", en: "Clear UI icons built with consistent strokes" } },
  { id: "filled", label: { zh: "面性图标", en: "Filled icons" }, description: { zh: "使用完整色块构成的醒目交互图标", en: "Bold UI icons built with solid filled shapes" } },
];

function stylesForUsage(usage: GenerationJobUsageFilter) {
  return ICON_STYLE_PRESETS.filter((preset) => usage === "interaction" ? preset.id === "line-icon" : preset.id !== "line-icon");
}

export function buildIconJobListHref(style: IconStylePresetId | undefined, page = 1, status?: GenerationJobStatusFilter, usage?: GenerationJobUsageFilter, structure?: GenerationJobStructureFilter) {
  const params = new URLSearchParams();
  if (style) params.set("style", style);
  if (status) params.set("status", status);
  if (usage) params.set("usage", usage);
  if (structure) params.set("structure", structure);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/icons${query ? `?${query}` : ""}`;
}

export function groupGenerationJobsByStyle(jobs: GenerationJobListItem[]) {
  return ICON_STYLE_PRESETS.map((preset) => ({ preset, jobs: jobs.filter((job) => job.stylePreset === preset.id) })).filter((group) => group.jobs.length > 0);
}

function matchesStatus(status: GenerationJobListItem["status"], filter?: GenerationJobStatusFilter) {
  return !filter || (filter === "in-progress" ? status === "queued" || status === "processing" : status === filter);
}

function pageFromPreload(preload: GenerationJobListPreload, usage: GenerationJobUsageFilter, style?: IconStylePresetId, status?: GenerationJobStatusFilter, structure?: GenerationJobStructureFilter): GenerationJobListPage {
  const jobs = preload.jobs.filter((job) => job.usage === usage && (!style || job.stylePreset === style) && (!structure || job.graphicStructure === structure) && matchesStatus(job.status, status)).slice(0, preload.pageSize);
  const total = structure ? preload.totals[`usage:${usage}:structure:${structure}:${status ?? "all"}`] ?? 0 : style ? preload.totals[`${style}:${status ?? "all"}`] ?? 0 : preload.totals[`usage:${usage}:${status ?? "all"}`] ?? 0;
  return { jobs, page: 1, pageSize: preload.pageSize, total, totalPages: Math.max(1, Math.ceil(total / preload.pageSize)) };
}

function JobCard({ job, locale }: { job: GenerationJobListItem; locale: "en" | "zh" }) {
  return <Link href={`/icons/${job.id}`} className="focus-ring block rounded-[20px] border border-border bg-white p-5 transition hover:border-brand">
    <div className="flex items-start justify-between gap-5">
      <div className="min-w-0">
        <p className="truncate font-black">{job.subjects.map((subject) => subject.name).join(locale === "zh" ? "、" : ", ") || (locale === "zh" ? "未命名图标集" : "Untitled icon set")}</p>
        <p className="mt-1 text-sm text-muted">{locale === "zh" ? "创建时间：" : "Created: "}{new Date(job.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</p>
      </div>
      <StatusBadge status={job.status}/>
    </div>
    {job.previewAssetIds.length > 0 ? <div className="mt-4 grid max-w-[420px] grid-cols-3 gap-3">{job.previewAssetIds.map((assetId, index) => <GeneratedIconPreview key={assetId} assetId={assetId} locale={locale} alt={locale === "zh" ? `生成方案 ${index + 1}` : `Generated option ${index + 1}`}/>)}</div> : null}
  </Link>;
}

export function IconJobList({ result, preload, selectedUsage, selectedStyle, selectedStructure, selectedStatus }: { result: GenerationJobListPage; preload: GenerationJobListPreload; selectedUsage: GenerationJobUsageFilter; selectedStyle?: IconStylePresetId; selectedStructure?: GenerationJobStructureFilter; selectedStatus?: GenerationJobStatusFilter }) {
  const { locale } = useLocale();
  const [filters, dispatchFilters] = useReducer(reduceIconJobFilters, {
    usage: selectedUsage,
    style: selectedStyle,
    structure: selectedStructure,
    status: selectedStatus,
  });
  const { usage: activeUsage, style: activeStyle, structure: activeStructure, status: activeStatus } = filters;
  const filtersChanged = activeUsage !== selectedUsage || activeStyle !== selectedStyle || activeStructure !== selectedStructure || activeStatus !== selectedStatus;
  const activeResult = result.page === 1 || filtersChanged ? pageFromPreload(preload, activeUsage, activeStyle, activeStatus, activeStructure) : result;
  const groups = activeUsage === "interaction" ? structureOptions.map((preset) => ({ preset, jobs: activeResult.jobs.filter((job) => job.graphicStructure === preset.id) })).filter((group) => group.jobs.length > 0) : groupGenerationJobsByStyle(activeResult.jobs);
  const pageStart = activeResult.total === 0 ? 0 : (activeResult.page - 1) * activeResult.pageSize + 1;
  const pageEnd = Math.min(activeResult.page * activeResult.pageSize, activeResult.total);
  function replaceFilterUrl(usage: GenerationJobUsageFilter, style?: IconStylePresetId, status?: GenerationJobStatusFilter, structure?: GenerationJobStructureFilter) {
    window.history.replaceState(window.history.state, "", buildIconJobListHref(style, 1, status, usage, structure));
  }
  function selectUsage(usage: GenerationJobUsageFilter) { dispatchFilters({ type: "select-usage", usage }); replaceFilterUrl(usage); }
  function selectStyle(style?: IconStylePresetId) { dispatchFilters({ type: "select-style", style }); replaceFilterUrl(activeUsage, style); }
  function selectStructure(structure?: GenerationJobStructureFilter) { dispatchFilters({ type: "select-structure", structure }); replaceFilterUrl(activeUsage, undefined, undefined, structure); }
  function selectStatus(status?: GenerationJobStatusFilter) { dispatchFilters({ type: "select-status", status }); replaceFilterUrl(activeUsage, activeStyle, status, activeStructure); }

  return <div>
    <h1 className="display-serif text-4xl font-medium tracking-[-.045em] sm:text-5xl">{locale === "zh" ? "我的图标" : "My Icons"}</h1>

    <div className="mt-6">
      <p className="mb-3 text-sm font-black">{locale === "zh" ? "图标类型" : "Icon type"}</p>
      <nav aria-label={locale === "zh" ? "按图标类型筛选" : "Filter by icon type"} className="flex flex-wrap gap-2">
        {usageOptions.map((option) => <button type="button" key={option.id} onClick={() => selectUsage(option.id)} aria-current={activeUsage === option.id ? "page" : undefined} className={`focus-ring rounded-full border px-4 py-2 text-sm font-bold transition ${activeUsage === option.id ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>{option.label[locale]}</button>)}
      </nav>
    </div>

    <div className="mt-5 border-t border-border pt-5">
      <p className="mb-3 text-sm font-black">{locale === "zh" ? "风格选择" : "Style"}</p>
      <nav aria-label={locale === "zh" ? "按风格筛选" : "Filter by style"} className="flex flex-wrap gap-2">
      <button type="button" onClick={() => activeUsage === "interaction" ? selectStructure(undefined) : selectStyle(undefined)} aria-current={activeUsage === "interaction" ? !activeStructure ? "page" : undefined : !activeStyle ? "page" : undefined} className={`focus-ring inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-bold transition ${(activeUsage === "interaction" ? !activeStructure : !activeStyle) ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>{locale === "zh" ? "全部风格" : "All styles"}</button>
      {activeUsage === "interaction" ? structureOptions.map((option) => <button type="button" key={option.id} onClick={() => selectStructure(option.id)} aria-current={activeStructure === option.id ? "page" : undefined} className={`focus-ring inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-bold transition ${activeStructure === option.id ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>{option.label[locale]}</button>) : stylesForUsage(activeUsage).map((preset) => <button type="button" key={preset.id} onClick={() => selectStyle(preset.id)} aria-current={activeStyle === preset.id ? "page" : undefined} className={`focus-ring inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-bold transition ${activeStyle === preset.id ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>{preset.label[locale]}</button>)}
      </nav>
    </div>

    <div className="mt-5 border-t border-border pt-5">
      <p className="mb-3 text-sm font-black">{locale === "zh" ? "状态选择" : "Status"}</p>
      <nav aria-label={locale === "zh" ? "按状态筛选" : "Filter by status"} className="flex flex-wrap gap-2">
        {statusOptions.map((option) => <button type="button" key={option.id ?? "all"} onClick={() => selectStatus(option.id)} aria-current={activeStatus === option.id ? "page" : undefined} className={`focus-ring rounded-full border px-4 py-2 text-sm font-bold transition ${activeStatus === option.id ? "border-brand bg-brand text-white" : "border-border bg-white hover:border-brand"}`}>{option.label[locale]}</button>)}
      </nav>
    </div>

    {activeResult.jobs.length === 0 ? <section className="mt-8 rounded-[20px] border border-dashed border-border p-8 text-center">
      <p className="font-bold">{activeStyle ? (locale === "zh" ? "暂无图标" : "No icons yet") : (locale === "zh" ? "还没有图标集" : "No icon sets yet")}</p>
      <Link href="/create" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">{locale === "zh" ? "创建一套图标" : "Create an icon set"}</Link>
    </section> : !activeStyle && !activeStructure ? <div className="mt-8 grid gap-4">{activeResult.jobs.map((job) => <JobCard key={job.id} job={job} locale={locale}/>)}</div> : <div className="mt-8 space-y-8">
      {groups.map(({ preset, jobs }) => <section key={preset.id} aria-labelledby={`style-${preset.id}`}>
        <div className="mb-3">
          <div><h2 id={`style-${preset.id}`} className="text-xl font-black">{preset.label[locale]}</h2><p className="mt-1 text-sm text-muted">{preset.description[locale]}</p></div>
        </div>
        <div className="grid gap-4">{jobs.map((job) => <JobCard key={job.id} job={job} locale={locale}/>)}</div>
      </section>)}
    </div>}

    {activeResult.totalPages > 1 && <nav aria-label={locale === "zh" ? "图标集分页" : "Icon set pagination"} className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
      <p className="text-sm text-muted">{locale === "zh" ? `显示 ${pageStart}–${pageEnd}，共 ${activeResult.total} 套` : `Showing ${pageStart}–${pageEnd} of ${activeResult.total}`}</p>
      <div className="flex items-center gap-2">
        {activeResult.page > 1 && <Link href={buildIconJobListHref(activeStyle, activeResult.page - 1, activeStatus, activeUsage, activeStructure)} className="focus-ring rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold hover:border-brand">{locale === "zh" ? "上一页" : "Previous"}</Link>}
        <span className="min-w-20 text-center text-sm font-bold">{activeResult.page} / {activeResult.totalPages}</span>
        {activeResult.page < activeResult.totalPages && <Link href={buildIconJobListHref(activeStyle, activeResult.page + 1, activeStatus, activeUsage, activeStructure)} className="focus-ring rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold hover:border-brand">{locale === "zh" ? "下一页" : "Next"}</Link>}
      </div>
    </nav>}
  </div>;
}
