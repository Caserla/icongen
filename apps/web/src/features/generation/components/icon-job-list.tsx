"use client";

import Link from "next/link";
import { SlidingFilterNav } from "@/components/ui/sliding-filter-nav";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ICON_STYLE_PRESETS, type IconStylePresetId } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
import { Toast } from "@/components/ui/toast";
import { GeneratedIconPreview } from "@/features/generation/components/generated-icon-preview";
import { reduceIconJobFilters } from "@/features/generation/icon-job-filters";
import { matchesGenerationJobStatus } from "@/features/generation/server/generation-job-list-reader";
import type {
  GenerationJobListItem,
  GenerationJobListPage,
  GenerationJobStatusFilter,
  GenerationJobStructureFilter,
  GenerationJobUsageFilter,
} from "@/features/generation/server/generation-job-list-reader";

export const ICON_LIST_SKELETON_COUNT = 4;

const statusOptions: {
  id?: GenerationJobStatusFilter;
  label: { zh: string; en: string };
}[] = [
  { label: { zh: "全部状态", en: "All statuses" } },
  { id: "in-progress", label: { zh: "生成中", en: "In progress" } },
  { id: "completed", label: { zh: "已完成", en: "Completed" } },
  { id: "partial", label: { zh: "部分完成", en: "Partially completed" } },
  { id: "failed", label: { zh: "生成失败", en: "Failed" } },
];

const usageOptions: {
  id: GenerationJobUsageFilter;
  label: { zh: string; en: string };
}[] = [
  { id: "interaction", label: { zh: "交互图标", en: "Interaction icons" } },
  { id: "illustration", label: { zh: "插画图标", en: "Illustration icons" } },
];
const structureOptions: {
  id: GenerationJobStructureFilter;
  label: { zh: string; en: string };
  description: { zh: string; en: string };
}[] = [
  {
    id: "linear",
    label: { zh: "线性图标", en: "Line icons" },
    description: {
      zh: "使用统一线条构成的清晰交互图标",
      en: "Clear UI icons built with consistent strokes",
    },
  },
  {
    id: "filled",
    label: { zh: "面性图标", en: "Filled icons" },
    description: {
      zh: "使用完整色块构成的醒目交互图标",
      en: "Bold UI icons built with solid filled shapes",
    },
  },
];

function stylesForUsage(usage: GenerationJobUsageFilter) {
  return ICON_STYLE_PRESETS.filter((preset) =>
    usage === "interaction"
      ? preset.id === "line-icon"
      : preset.id !== "line-icon",
  );
}

export function buildIconJobListHref(
  style: IconStylePresetId | undefined,
  page = 1,
  status?: GenerationJobStatusFilter,
  usage?: GenerationJobUsageFilter,
  structure?: GenerationJobStructureFilter,
) {
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
  return ICON_STYLE_PRESETS.map((preset) => ({
    preset,
    jobs: jobs.filter((job) => job.stylePreset === preset.id),
  })).filter((group) => group.jobs.length > 0);
}

function listCacheKey(
  usage: GenerationJobUsageFilter,
  style?: IconStylePresetId,
  status?: GenerationJobStatusFilter,
  structure?: GenerationJobStructureFilter,
  page = 1,
) {
  return `${usage}:${style ?? "all"}:${structure ?? "all"}:${status ?? "all"}:${page}`;
}

// Keep already-rendered pages alive across list -> details -> list navigation.
// The changed card is refreshed separately when the user returns.
const iconJobPageCache = new Map<string, GenerationJobListPage>();

export function validatePageJump(value: string, totalPages: number) {
  const normalized = value.trim();
  if (!normalized) return { error: "empty" as const };
  if (!/^\d+$/.test(normalized)) return { error: "integer" as const };
  const page = Number(normalized);
  if (!Number.isSafeInteger(page)) return { error: "integer" as const };
  if (page < 1) return { error: "below-range" as const };
  if (page > totalPages) return { error: "above-range" as const };
  return { page };
}

function PageJumpInput({
  page,
  totalPages,
  locale,
  disabled,
  onJump,
  onInvalid,
}: {
  page: number;
  totalPages: number;
  locale: "en" | "zh";
  disabled: boolean;
  onJump: (page: number) => void;
  onInvalid: (message: string) => void;
}) {
  const [value, setValue] = useState(String(page));
  function submit() {
    const result = validatePageJump(value, totalPages);
    if (result.page !== undefined) {
      setValue(String(result.page));
      if (result.page !== page) onJump(result.page);
      return;
    }
    const messages =
      locale === "zh"
        ? {
            empty: "请输入要跳转的页码。",
            integer: "页码必须是整数。",
            "below-range": "页码不能小于 1。",
            "above-range": `页码不能超过 ${totalPages}。`,
          }
        : {
            empty: "Enter a page number.",
            integer: "The page number must be an integer.",
            "below-range": "The page number cannot be less than 1.",
            "above-range": `The page number cannot exceed ${totalPages}.`,
          };
    onInvalid(messages[result.error]);
    setValue(String(page));
  }
  if (totalPages <= 1)
    return (
      <span
        aria-current="page"
        className="flex h-8 min-w-14 items-center justify-center px-2 text-center text-sm font-black leading-none tabular-nums text-foreground"
      >
        1<span className="mx-1.5 text-xs font-medium text-muted">/</span>
        <span className="text-xs text-muted">1</span>
      </span>
    );
  return (
    <label className="pointer-events-auto flex h-8 items-center gap-1 px-2 text-sm font-black leading-none tabular-nums text-foreground">
      <span className="sr-only">
        {locale === "zh" ? "输入页码" : "Enter page number"}
      </span>
      <input
        key={page}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={submit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        aria-label={
          locale === "zh"
            ? `当前第 ${page} 页，输入页码跳转`
            : `Page ${page}; enter a page to jump`
        }
        className="h-7 w-7 border-0 bg-transparent p-0 text-center text-sm font-black text-brand outline-none transition-colors focus:text-brand-strong disabled:cursor-default"
      />
      <span className="mx-0.5 text-xs font-medium text-muted">/</span>
      <span className="min-w-5 text-center text-xs font-bold text-muted">
        {totalPages}
      </span>
    </label>
  );
}

function JobPreviewGroup({
  urls,
  fallbackUrls,
  locale,
  eager = false,
}: {
  urls: string[];
  fallbackUrls: string[];
  locale: "en" | "zh";
  eager?: boolean;
}) {
  return (
    <div className="icon-library-card__previews mt-4 grid grid-cols-3 gap-2">
      {urls.map((src, index) => (
        <div key={src} className="relative aspect-square overflow-hidden">
          <div className="h-full w-full">
            <GeneratedIconPreview
              src={src}
              fallbackSrc={fallbackUrls[index]}
              locale={locale}
              alt={
                locale === "zh"
                  ? `生成方案 ${index + 1}`
                  : `Generated option ${index + 1}`
              }
              showSkeleton
              loading={eager ? "eager" : "lazy"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function JobCard({
  job,
  locale,
  returnHref,
  eagerPreviews = false,
}: {
  job: GenerationJobListItem;
  locale: "en" | "zh";
  returnHref: string;
  eagerPreviews?: boolean;
}) {
  return (
    <Link
      href={`/icons/${job.id}`}
      onClick={() => {
        sessionStorage.setItem("icongen:icons-scroll", String(window.scrollY));
        sessionStorage.setItem("icongen:icons-return", "1");
        sessionStorage.setItem("icongen:icons-return-href", returnHref);
        sessionStorage.setItem(
          `icongen:job-previews:${job.id}`,
          JSON.stringify(job.previewUrls),
        );
      }}
      className="icon-library-card focus-ring group block"
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <p className="icon-library-card__eyebrow">
            PROJECT / {job.id.slice(0, 8)}
          </p>
          <p className="icon-library-card__title line-clamp-2">
            {job.subjects
              .map((subject) => subject.name)
              .join(locale === "zh" ? "、" : ", ") ||
              (locale === "zh" ? "未命名图标集" : "Untitled icon set")}
          </p>
          <p className="icon-library-card__date">
            {locale === "zh" ? "创建时间：" : "Created: "}
            {new Date(job.createdAt).toLocaleString(
              locale === "zh" ? "zh-CN" : "en-US",
            )}
          </p>
        </div>
        <div className="shrink-0">
          <StatusBadge status={job.status} />
        </div>
      </div>
      {job.previewUrls.length > 0 ? (
        <JobPreviewGroup
          urls={job.previewUrls}
          fallbackUrls={job.previewFallbackUrls}
          locale={locale}
          eager={eagerPreviews}
        />
      ) : null}
    </Link>
  );
}

export function IconJobList({
  selectedPage,
  selectedUsage,
  selectedStyle,
  selectedStructure,
  selectedStatus,
}: {
  selectedPage: number;
  selectedUsage: GenerationJobUsageFilter;
  selectedStyle?: IconStylePresetId;
  selectedStructure?: GenerationJobStructureFilter;
  selectedStatus?: GenerationJobStatusFilter;
}) {
  const { locale } = useLocale();
  const initialCacheKey = listCacheKey(
    selectedUsage,
    selectedStyle,
    selectedStatus,
    selectedStructure,
    selectedPage,
  );
  const cachedInitialResult = iconJobPageCache.get(initialCacheKey);
  const [liveResult, setLiveResult] = useState<GenerationJobListPage>(
    () =>
      cachedInitialResult ?? {
        jobs: [],
        page: selectedPage,
        pageSize: 12,
        total: 0,
        totalPages: 1,
      },
  );
  const [isLoading, setIsLoading] = useState(!cachedInitialResult);
  const [activePage, setActivePage] = useState(selectedPage);
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pageToast, setPageToast] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const requestSequence = useRef(0);
  const activeListRequest = useRef<AbortController | null>(null);
  const pendingScrollTop = useRef<number | null>(null);
  const resultCache = useRef(iconJobPageCache);
  const [filters, dispatchFilters] = useReducer(reduceIconJobFilters, {
    usage: selectedUsage,
    style: selectedStyle,
    structure: selectedStructure,
    status: selectedStatus,
  });
  const {
    usage: activeUsage,
    style: activeStyle,
    structure: activeStructure,
    status: activeStatus,
  } = filters;
  const activeResult = liveResult;
  useEffect(() => {
    const timer = window.setTimeout(
      () => setShowLoadingSkeleton(isLoading),
      isLoading ? 220 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [isLoading]);
  const groups =
    activeUsage === "interaction"
      ? structureOptions
          .map((preset) => ({
            preset,
            jobs: activeResult.jobs.filter(
              (job) => job.graphicStructure === preset.id,
            ),
          }))
          .filter((group) => group.jobs.length > 0)
      : groupGenerationJobsByStyle(activeResult.jobs);
  const currentListHref = buildIconJobListHref(
    activeStyle,
    activeResult.page,
    activeStatus,
    activeUsage,
    activeStructure,
  );
  const loadList = useCallback(
    async (
      usage: GenerationJobUsageFilter,
      style?: IconStylePresetId,
      status?: GenerationJobStatusFilter,
      structure?: GenerationJobStructureFilter,
      page = 1,
    ) => {
      const key = listCacheKey(usage, style, status, structure, page);
      const cached = resultCache.current.get(key);
      const sequence = ++requestSequence.current;
      activeListRequest.current?.abort();
      if (cached) {
        activeListRequest.current = null;
        setLiveResult(cached);
        setIsLoading(false);
        setLoadFailed(false);
        return;
      }
      setIsLoading(true);
      setLoadFailed(false);
      const controller = new AbortController();
      activeListRequest.current = controller;
      try {
        const response = await fetch("/api/generation/jobs/list", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ page, usage, style, status, structure }),
        });
        if (!response.ok) throw new Error("Icon list request failed");
        const next = (await response.json()) as GenerationJobListPage;
        const containsMismatchedJob = next.jobs.some(
          (job) =>
            job.usage !== usage ||
            (style !== undefined && job.stylePreset !== style) ||
            (structure !== undefined && job.graphicStructure !== structure) ||
            !matchesGenerationJobStatus(job.status, status),
        );
        if (containsMismatchedJob)
          throw new Error(
            "Icon list response did not match its requested filters",
          );
        resultCache.current.set(key, next);
        if (sequence === requestSequence.current) setLiveResult(next);
      } catch (error) {
        if (
          sequence === requestSequence.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        )
          setLoadFailed(true);
      } finally {
        if (sequence === requestSequence.current) {
          activeListRequest.current = null;
          setIsLoading(false);
        }
      }
    },
    [],
  );
  useEffect(() => {
    const frame = requestAnimationFrame(
      () =>
        void loadList(
          activeUsage,
          activeStyle,
          activeStatus,
          activeStructure,
          activePage,
        ),
    );
    return () => {
      cancelAnimationFrame(frame);
      activeListRequest.current?.abort();
    };
  }, [
    activeStatus,
    activeStructure,
    activeStyle,
    activeUsage,
    activePage,
    loadList,
  ]);
  useEffect(() => {
    rememberIconJobFilters(
      buildIconJobListHref(
        activeStyle,
        liveResult.page,
        activeStatus,
        activeUsage,
        activeStructure,
      ),
    );
  }, [
    activeStatus,
    activeStructure,
    activeStyle,
    activeUsage,
    liveResult.page,
  ]);
  const refreshChangedCard = useCallback(async () => {
    const jobId = sessionStorage.getItem("icongen:refresh-job");
    if (!jobId) return;
    sessionStorage.removeItem("icongen:refresh-job");
    try {
      const response = await fetch(`/api/generation/jobs/${jobId}/summary`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const item = (await response.json()) as GenerationJobListItem;
      setLiveResult((current) => ({
        ...current,
        jobs: current.jobs.map((job) => (job.id === item.id ? item : job)),
      }));
      for (const [key, cached] of resultCache.current)
        resultCache.current.set(key, {
          ...cached,
          jobs: cached.jobs.map((job) => (job.id === item.id ? item : job)),
        });
    } catch {
      sessionStorage.setItem("icongen:refresh-job", jobId);
    }
  }, []);
  useEffect(() => {
    const shouldRestoreScroll =
      sessionStorage.getItem("icongen:icons-return") === "1" ||
      Boolean(sessionStorage.getItem("icongen:refresh-job"));
    const scroll = Number(sessionStorage.getItem("icongen:icons-scroll"));
    sessionStorage.removeItem("icongen:icons-return");
    pendingScrollTop.current =
      shouldRestoreScroll && Number.isFinite(scroll) && scroll > 0
        ? scroll
        : null;
    sessionStorage.removeItem("icongen:icons-scroll");
    requestAnimationFrame(() => void refreshChangedCard());
    const onPageShow = () => void refreshChangedCard();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refreshChangedCard]);
  useEffect(() => {
    if (isLoading || pendingScrollTop.current === null) return;
    const target = pendingScrollTop.current;
    pendingScrollTop.current = null;
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => window.scrollTo({ top: target })),
    );
    return () => cancelAnimationFrame(frame);
  }, [isLoading]);
  useEffect(() => {
    if (!pageToast) return;
    const timeout = window.setTimeout(() => setPageToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [pageToast]);
  useEffect(() => {
    const updateBackToTopVisibility = () =>
      setShowBackToTop(window.scrollY > 480);
    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, {
      passive: true,
    });
    return () =>
      window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);
  function scrollBackToTop() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }
  function replaceFilterUrl(
    usage: GenerationJobUsageFilter,
    style?: IconStylePresetId,
    status?: GenerationJobStatusFilter,
    structure?: GenerationJobStructureFilter,
  ) {
    const href = buildIconJobListHref(style, 1, status, usage, structure);
    rememberIconJobFilters(href);
    // Filters are already fetched and rendered client-side. Updating the URL
    // through the History API avoids a second App Router navigation, which
    // otherwise remounts the page and briefly flashes the route skeleton.
    window.history.replaceState(window.history.state, "", href);
  }
  function prepareListTransition(
    usage: GenerationJobUsageFilter,
    style?: IconStylePresetId,
    status?: GenerationJobStatusFilter,
    structure?: GenerationJobStructureFilter,
    page = 1,
  ) {
    const cached = resultCache.current.get(
      listCacheKey(usage, style, status, structure, page),
    );
    setLoadFailed(false);
    if (cached) {
      setLiveResult(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }
  function selectUsage(usage: GenerationJobUsageFilter) {
    prepareListTransition(usage);
    setActivePage(1);
    dispatchFilters({ type: "select-usage", usage });
    replaceFilterUrl(usage);
  }
  function selectStyle(style?: IconStylePresetId) {
    prepareListTransition(activeUsage, style);
    setActivePage(1);
    dispatchFilters({ type: "select-style", style });
    replaceFilterUrl(activeUsage, style);
  }
  function selectStructure(structure?: GenerationJobStructureFilter) {
    prepareListTransition(activeUsage, undefined, undefined, structure);
    setActivePage(1);
    dispatchFilters({ type: "select-structure", structure });
    replaceFilterUrl(activeUsage, undefined, undefined, structure);
  }
  function selectStatus(status?: GenerationJobStatusFilter) {
    prepareListTransition(activeUsage, activeStyle, status, activeStructure);
    setActivePage(1);
    dispatchFilters({ type: "select-status", status });
    replaceFilterUrl(activeUsage, activeStyle, status, activeStructure);
  }
  function selectPage(page: number) {
    prepareListTransition(
      activeUsage,
      activeStyle,
      activeStatus,
      activeStructure,
      page,
    );
    setActivePage(page);
    const href = buildIconJobListHref(
      activeStyle,
      page,
      activeStatus,
      activeUsage,
      activeStructure,
    );
    rememberIconJobFilters(href);
    window.history.replaceState(window.history.state, "", href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="icons-studio">
      {pageToast ? (
        <Toast message={pageToast} variant="warning" placement="center" />
      ) : null}
      <div className="icons-studio__filters">
        <section className="icons-filter-group">
          <p className="mb-3 text-sm font-black">
            {locale === "zh" ? "图标类型" : "Icon type"}
          </p>
          <SlidingFilterNav
            aria-label={
              locale === "zh" ? "按图标类型筛选" : "Filter by icon type"
            }
            className="icons-filter-options"
          >
            {usageOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                onClick={() => selectUsage(option.id)}
                aria-current={activeUsage === option.id ? "page" : undefined}
                className="icons-filter-option focus-ring"
              >
                {option.label[locale]}
              </button>
            ))}
          </SlidingFilterNav>
        </section>

        <section className="icons-filter-group">
          <p className="mb-3 text-sm font-black">
            {locale === "zh" ? "风格选择" : "Style"}
          </p>
          <SlidingFilterNav
            aria-label={locale === "zh" ? "按风格筛选" : "Filter by style"}
            className="icons-filter-options"
          >
            <button
              type="button"
              onClick={() =>
                activeUsage === "interaction"
                  ? selectStructure(undefined)
                  : selectStyle(undefined)
              }
              aria-current={
                activeUsage === "interaction"
                  ? !activeStructure
                    ? "page"
                    : undefined
                  : !activeStyle
                    ? "page"
                    : undefined
              }
              className="icons-filter-option focus-ring"
            >
              {locale === "zh" ? "全部风格" : "All styles"}
            </button>
            {activeUsage === "interaction"
              ? structureOptions.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => selectStructure(option.id)}
                    aria-current={
                      activeStructure === option.id ? "page" : undefined
                    }
                    className="icons-filter-option focus-ring"
                  >
                    {option.label[locale]}
                  </button>
                ))
              : stylesForUsage(activeUsage).map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    onClick={() => selectStyle(preset.id)}
                    aria-current={
                      activeStyle === preset.id ? "page" : undefined
                    }
                    className="icons-filter-option focus-ring"
                  >
                    {preset.label[locale]}
                  </button>
                ))}
          </SlidingFilterNav>
        </section>

        <section className="icons-filter-group">
          <p className="mb-3 text-sm font-black">
            {locale === "zh" ? "状态选择" : "Status"}
          </p>
          <SlidingFilterNav
            aria-label={locale === "zh" ? "按状态筛选" : "Filter by status"}
            className="icons-filter-options"
          >
            {statusOptions.map((option) => (
              <button
                type="button"
                key={option.id ?? "all"}
                onClick={() => selectStatus(option.id)}
                aria-current={activeStatus === option.id ? "page" : undefined}
                className="icons-filter-option focus-ring"
              >
                {option.label[locale]}
              </button>
            ))}
          </SlidingFilterNav>
        </section>
      </div>

      {isLoading && activeResult.jobs.length === 0 ? (
        <PageState />
      ) : loadFailed ? (
        <PageState kind="error" onRetry={()=>void loadList(activeUsage,activeStyle,activeStatus,activeStructure,activeResult.page)} />
      ) : activeResult.jobs.length === 0 ? <PageState kind="empty" title={activeStyle||activeStructure||activeStatus?(locale==="zh"?"暂无符合筛选条件的图标":"No matching icons"):undefined}/> : !activeStyle &&
        !activeStructure ? (
        <div
          className={`icons-jobs-grid stagger-grid icons-list-swap mt-6 ${isLoading ? "is-updating" : ""}`}
        >
          {activeResult.jobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              locale={locale}
              returnHref={currentListHref}
              eagerPreviews={index < 4}
            />
          ))}
        </div>
      ) : (
        <div
          className={`icons-studio__groups icons-list-swap mt-6 space-y-10 ${isLoading ? "is-updating" : ""}`}
        >
          {groups.map(({ preset, jobs }) => (
            <section key={preset.id} aria-labelledby={`style-${preset.id}`}>
              <div className="icons-studio__group-heading mb-4">
                <div>
                  <h2 id={`style-${preset.id}`} className="text-xl font-black">
                    {preset.label[locale]}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {preset.description[locale]}
                  </p>
                </div>
              </div>
              <div className="icons-jobs-grid stagger-grid">
                {jobs.map((job, index) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    locale={locale}
                    returnHref={currentListHref}
                    eagerPreviews={index < 4}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeResult.total > 0 && (
        <nav
          aria-label={locale === "zh" ? "图标集分页" : "Icon set pagination"}
          aria-busy={isLoading}
          className="pagination-float pointer-events-none fixed bottom-6 left-1/2 z-[80] flex h-10 -translate-x-1/2 items-center gap-0.5 rounded-full border px-1"
        >
          <span className="flex items-center">
            <button
              type="button"
              disabled={isLoading || activeResult.page <= 1}
              title={locale === "zh" ? "上一页" : "Previous"}
              aria-label={
                locale === "zh"
                  ? activeResult.page <= 1
                    ? "已是第一页"
                    : `上一页，第 ${activeResult.page - 1} 页`
                  : activeResult.page <= 1
                    ? "Already on the first page"
                    : `Previous, page ${activeResult.page - 1}`
              }
              onClick={() => selectPage(activeResult.page - 1)}
              className="focus-ring pointer-events-auto grid size-8 place-items-center rounded-full text-foreground transition-colors duration-150 hover:text-brand disabled:cursor-not-allowed disabled:text-muted disabled:opacity-30"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4 fill-none stroke-current stroke-[2.2]"
              >
                <path
                  d="m14.5 6.5-5 5.5 5 5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </span>
          <PageJumpInput
            key={`${activeResult.page}:${activeResult.totalPages}`}
            page={activeResult.page}
            totalPages={activeResult.totalPages}
            locale={locale}
            disabled={isLoading}
            onJump={selectPage}
            onInvalid={setPageToast}
          />
          <span className="flex items-center">
            <button
              type="button"
              disabled={
                isLoading || activeResult.page >= activeResult.totalPages
              }
              title={locale === "zh" ? "下一页" : "Next"}
              aria-label={
                locale === "zh"
                  ? activeResult.page >= activeResult.totalPages
                    ? "已是最后一页"
                    : `下一页，第 ${activeResult.page + 1} 页`
                  : activeResult.page >= activeResult.totalPages
                    ? "Already on the last page"
                    : `Next, page ${activeResult.page + 1}`
              }
              onClick={() => selectPage(activeResult.page + 1)}
              className="focus-ring pointer-events-auto grid size-8 place-items-center rounded-full text-foreground transition-colors duration-150 hover:text-brand disabled:cursor-not-allowed disabled:text-muted disabled:opacity-30"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4 fill-none stroke-current stroke-[2.2]"
              >
                <path
                  d="m9.5 6.5 5 5.5-5 5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </span>
          {isLoading ? (
            <span className="pagination-loading-bar" aria-hidden="true" />
          ) : null}
        </nav>
      )}
      <button
        type="button"
        onClick={scrollBackToTop}
        aria-label={locale === "zh" ? "回到顶部" : "Back to top"}
        title={locale === "zh" ? "回到顶部" : "Back to top"}
        tabIndex={showBackToTop ? 0 : -1}
        className={`pagination-float focus-ring fixed bottom-6 right-4 z-[80] grid size-10 place-items-center rounded-full border text-foreground transition-[opacity,transform,color] duration-200 hover:-translate-y-0.5 hover:text-brand sm:right-6 ${showBackToTop ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[18px] fill-none stroke-current stroke-[2.2]"
        >
          <path
            d="m6.5 14.5 5.5-5 5.5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
import { PageState } from "@/components/ui/page-state";
