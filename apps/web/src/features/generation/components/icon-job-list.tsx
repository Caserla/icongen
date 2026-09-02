"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ICON_STYLE_PRESETS, type IconStylePresetId } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
import { GeneratedIconPreview } from "@/features/generation/components/generated-icon-preview";
import { reduceIconJobFilters } from "@/features/generation/icon-job-filters";
import type { GenerationJobListItem, GenerationJobListPage, GenerationJobStatusFilter, GenerationJobStructureFilter, GenerationJobUsageFilter } from "@/features/generation/server/generation-job-list-reader";

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

function rememberIconJobFilters(href: string) {
  const query = href.split("?")[1] ?? "";
  document.cookie = `icongen_icon_filters=${encodeURIComponent(query)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function groupGenerationJobsByStyle(jobs: GenerationJobListItem[]) {
  return ICON_STYLE_PRESETS.map((preset) => ({ preset, jobs: jobs.filter((job) => job.stylePreset === preset.id) })).filter((group) => group.jobs.length > 0);
}

function listCacheKey(usage: GenerationJobUsageFilter, style?: IconStylePresetId, status?: GenerationJobStatusFilter, structure?: GenerationJobStructureFilter, page = 1) {
  return `${usage}:${style ?? "all"}:${structure ?? "all"}:${status ?? "all"}:${page}`;
}

function JobPreviewGroup({ urls, locale }: { urls: string[]; locale: "en" | "zh" }) {
  const key = urls.join("\n");
  const [loadState, setLoadState] = useState<{ key: string; settled: Set<number> }>(() => ({ key, settled: new Set() }));
  const settled = loadState.key === key ? loadState.settled : new Set<number>();
  const ready = urls.length > 0 && settled.size === urls.length;
  const markSettled = useCallback((index: number) => {
    setLoadState((current) => {
      const currentSettled = current.key === key ? current.settled : new Set<number>();
      if (currentSettled.has(index)) return current;
      const next = new Set(currentSettled);
      next.add(index);
      return { key, settled: next };
    });
  }, [key]);
  return <div className="mt-4 grid max-w-[420px] grid-cols-3 gap-3" aria-busy={!ready} aria-label={!ready ? (locale === "zh" ? "正在加载预览图" : "Loading previews") : undefined}>
    {urls.map((src, index) => <div key={src} className="relative aspect-square overflow-hidden">
      {!ready ? <span className="absolute inset-0 z-[2]"><SkeletonBlock className="h-full w-full rounded-[inherit]" /></span> : null}
      <div className={`h-full w-full transition-none ${ready ? "visible" : "invisible"}`}>
        <GeneratedIconPreview src={src} locale={locale} alt={locale === "zh" ? `生成方案 ${index + 1}` : `Generated option ${index + 1}`} showSkeleton={false} onSettled={() => markSettled(index)}/>
      </div>
    </div>)}
  </div>;
}

function JobCard({ job, locale }: { job: GenerationJobListItem; locale: "en" | "zh" }) {
  return <Link href={`/icons/${job.id}`} onClick={() => { sessionStorage.setItem("icongen:icons-scroll", String(window.scrollY)); sessionStorage.setItem("icongen:icons-return", "1"); }} className="focus-ring block rounded-[20px] border border-border bg-white p-5 transition hover:border-brand">
    <div className="flex items-start justify-between gap-5">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-black leading-snug">{job.subjects.map((subject) => subject.name).join(locale === "zh" ? "、" : ", ") || (locale === "zh" ? "未命名图标集" : "Untitled icon set")}</p>
        <p className="mt-1 text-sm text-muted">{locale === "zh" ? "创建时间：" : "Created: "}{new Date(job.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</p>
      </div>
      <div className="shrink-0"><StatusBadge status={job.status}/></div>
    </div>
    {job.previewUrls.length > 0 ? <JobPreviewGroup urls={job.previewUrls} locale={locale}/> : null}
  </Link>;
}

export function IconJobList({ selectedPage, selectedUsage, selectedStyle, selectedStructure, selectedStatus }: { selectedPage: number; selectedUsage: GenerationJobUsageFilter; selectedStyle?: IconStylePresetId; selectedStructure?: GenerationJobStructureFilter; selectedStatus?: GenerationJobStatusFilter }) {
  const { locale } = useLocale();
  const [liveResult, setLiveResult] = useState<GenerationJobListPage>({ jobs: [], page: selectedPage, pageSize: 12, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const requestSequence = useRef(0);
  const pendingScrollTop = useRef<number | null>(null);
  const resultCache = useRef(new Map<string, GenerationJobListPage>());
  const [filters, dispatchFilters] = useReducer(reduceIconJobFilters, {
    usage: selectedUsage,
    style: selectedStyle,
    structure: selectedStructure,
    status: selectedStatus,
  });
  const { usage: activeUsage, style: activeStyle, structure: activeStructure, status: activeStatus } = filters;
  const activeResult = liveResult;
  const groups = activeUsage === "interaction" ? structureOptions.map((preset) => ({ preset, jobs: activeResult.jobs.filter((job) => job.graphicStructure === preset.id) })).filter((group) => group.jobs.length > 0) : groupGenerationJobsByStyle(activeResult.jobs);
  const pageStart = activeResult.total === 0 ? 0 : (activeResult.page - 1) * activeResult.pageSize + 1;
  const pageEnd = Math.min(activeResult.page * activeResult.pageSize, activeResult.total);
  const showStatusEmptyState = activeStatus === "in-progress" || activeStatus === "partial" || activeStatus === "failed";
  const loadList = useCallback(async (usage: GenerationJobUsageFilter, style?: IconStylePresetId, status?: GenerationJobStatusFilter, structure?: GenerationJobStructureFilter, page = 1) => {
    const key = listCacheKey(usage, style, status, structure, page);
    const cached = resultCache.current.get(key);
    const sequence = ++requestSequence.current;
    if (cached) {
      setLiveResult(cached);
      setIsLoading(false);
      setLoadFailed(false);
      return;
    }
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch("/api/generation/jobs/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ page, usage, style, status, structure }),
      });
      if (!response.ok) throw new Error("Icon list request failed");
      const next = await response.json() as GenerationJobListPage;
      resultCache.current.set(key, next);
      if (sequence === requestSequence.current) setLiveResult(next);
    } catch {
      if (sequence === requestSequence.current) setLoadFailed(true);
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadList(selectedUsage, selectedStyle, selectedStatus, selectedStructure, selectedPage));
    return () => cancelAnimationFrame(frame);
  }, [loadList, selectedPage, selectedStatus, selectedStructure, selectedStyle, selectedUsage]);
  useEffect(() => {
    rememberIconJobFilters(
      buildIconJobListHref(
        selectedStyle,
        liveResult.page,
        selectedStatus,
        selectedUsage,
        selectedStructure,
      ),
    );
  }, [liveResult.page, selectedStatus, selectedStructure, selectedStyle, selectedUsage]);
  const refreshChangedCard = useCallback(async () => {
    const jobId = sessionStorage.getItem("icongen:refresh-job");
    if (!jobId) return;
    sessionStorage.removeItem("icongen:refresh-job");
    try {
      const response = await fetch(`/api/generation/jobs/${jobId}/summary`, { cache: "no-store" });
      if (!response.ok) return;
      const item = await response.json() as GenerationJobListItem;
      setLiveResult((current) => ({ ...current, jobs: current.jobs.map((job) => job.id === item.id ? item : job) }));
      for (const [key, cached] of resultCache.current)
        resultCache.current.set(key, { ...cached, jobs: cached.jobs.map((job) => job.id === item.id ? item : job) });
    } catch {
      sessionStorage.setItem("icongen:refresh-job", jobId);
    }
  }, []);
  useEffect(() => {
    const shouldRestoreScroll = sessionStorage.getItem("icongen:icons-return") === "1" || Boolean(sessionStorage.getItem("icongen:refresh-job"));
    const scroll = Number(sessionStorage.getItem("icongen:icons-scroll"));
    sessionStorage.removeItem("icongen:icons-return");
    pendingScrollTop.current = shouldRestoreScroll && Number.isFinite(scroll) && scroll > 0 ? scroll : 0;
    sessionStorage.removeItem("icongen:icons-scroll");
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    requestAnimationFrame(() => void refreshChangedCard());
    const onPageShow = () => void refreshChangedCard();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refreshChangedCard]);
  useEffect(() => {
    if (isLoading || pendingScrollTop.current === null) return;
    const target = pendingScrollTop.current;
    pendingScrollTop.current = null;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: target })));
    return () => cancelAnimationFrame(frame);
  }, [isLoading]);
  function replaceFilterUrl(usage: GenerationJobUsageFilter, style?: IconStylePresetId, status?: GenerationJobStatusFilter, structure?: GenerationJobStructureFilter) {
    const href = buildIconJobListHref(style, 1, status, usage, structure);
    window.history.replaceState(window.history.state, "", href);
    rememberIconJobFilters(href);
  }
  function selectUsage(usage: GenerationJobUsageFilter) { dispatchFilters({ type: "select-usage", usage }); replaceFilterUrl(usage); void loadList(usage); }
  function selectStyle(style?: IconStylePresetId) { dispatchFilters({ type: "select-style", style }); replaceFilterUrl(activeUsage, style); void loadList(activeUsage, style); }
  function selectStructure(structure?: GenerationJobStructureFilter) { dispatchFilters({ type: "select-structure", structure }); replaceFilterUrl(activeUsage, undefined, undefined, structure); void loadList(activeUsage, undefined, undefined, structure); }
  function selectStatus(status?: GenerationJobStatusFilter) { dispatchFilters({ type: "select-status", status }); replaceFilterUrl(activeUsage, activeStyle, status, activeStructure); void loadList(activeUsage, activeStyle, status, activeStructure); }

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

    {isLoading ? <div className="mt-8 grid gap-4" aria-busy="true" aria-label={locale === "zh" ? "正在加载图标" : "Loading icons"}>{[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-44 rounded-[20px]" />)}</div> : loadFailed ? <section className="mt-8 rounded-[20px] border border-dashed border-border p-8 text-center"><p className="font-bold text-muted">{locale === "zh" ? "图标加载失败，请重新选择后重试。" : "Icons failed to load. Select the filter again to retry."}</p></section> : activeResult.jobs.length === 0 ? <section className="mt-8 rounded-[20px] border border-dashed border-border p-8 text-center">
      {showStatusEmptyState ? <Image src="/images/placeholders/generated-icon-no-options-v7.png" alt="" width={880} height={552} className="mx-auto h-auto w-56 object-contain opacity-90 sm:w-64" priority/> : null}
      <p className={`${showStatusEmptyState ? "mt-3 text-lg text-[#898BAF]" : ""} font-bold`}>{showStatusEmptyState || activeStyle ? (locale === "zh" ? "暂无图标" : "No icons yet") : (locale === "zh" ? "还没有图标集" : "No icon sets yet")}</p>
      {!showStatusEmptyState ? <Link href="/create" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">{locale === "zh" ? "创建一套图标" : "Create an icon set"}</Link> : null}
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
