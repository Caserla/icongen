"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GenerationJobV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
import { Toast } from "@/components/ui/toast";
import {
  applyVariantPreview,
  hasAppliedVariantPreview,
  mergePolledGenerationJob,
  shouldRevealGenerationPreview,
  type AppliedVariantPreview,
} from "@/features/generation/variant-preview-update";
import {
  hasRepeatedPollingFailures,
  isGenerationStalled,
} from "@/features/generation/generation-timeout";
import { VariantEditDialog } from "./variant-edit-dialog";
import { FavoriteToggle } from "./favorites-drawer";

const finished = new Set(["completed", "partial", "failed"]);

export function JobDetails({ initialJob }: { initialJob: GenerationJobV2 }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [job, setJob] = useState(() => hydrateCachedPreviews(initialJob));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [includeSvg, setIncludeSvg] = useState(false);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollFailureCount, setPollFailureCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<{
    variant: GenerationJobV2["subjects"][number]["variants"][number];
    subjectName: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const requestedInitialAssets = useRef(false);
  const [revealedDuringGeneration, setRevealedDuringGeneration] = useState(
    !finished.has(initialJob.status),
  );
  const [settledPreviewUrls, setSettledPreviewUrls] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!previewing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewing(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewing]);

  async function refreshJob(change?: AppliedVariantPreview) {
    if (change) {
      setJob((current) => applyVariantPreview(current, change));
    }
    const response = await fetch(`/api/generation/jobs/${job.id}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      if (change) return;
      throw new Error(
        locale === "zh"
          ? "无法刷新生成结果。"
          : "Could not refresh generation results.",
      );
    }
    const refreshed = (await response.json()) as GenerationJobV2;
    const appliedRevisionIsVisible =
      !change || hasAppliedVariantPreview(refreshed, change);
    if (appliedRevisionIsVisible) setJob(refreshed);
    setLastUpdatedAt(Date.now());
    setPollFailureCount(0);
  }

  async function refreshStatusNow() {
    setIsRefreshing(true);
    try {
      await refreshJob();
    } catch {
      setPollFailureCount((count) => count + 1);
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (finished.has(job.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch(`/api/generation/jobs/${job.id}`, {
          cache: "no-store",
        });
        if (response.ok && !cancelled) {
          const refreshed = (await response.json()) as GenerationJobV2;
          setJob((current) => mergePolledGenerationJob(current, refreshed));
          setLastUpdatedAt(Date.now());
          setPollFailureCount(0);
        }
      } catch {
        if (!cancelled) setPollFailureCount((count) => count + 1);
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
          timer = window.setTimeout(refresh, document.hidden ? 8000 : 2500);
        }
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [job.id, job.status]);

  useEffect(() => {
    if (finished.has(job.status)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [job.status]);

  const phaseLabels: Record<string, [string, string]> = {
    queued: ["排队等待生成", "In queue"],
    compiling: ["正在整理图标要求", "Preparing icon instructions"],
    generating: ["正在生成图标", "Generating icons"],
    "processing-assets": ["正在准备输出尺寸", "Preparing output sizes"],
    saving: ["正在保存图标", "Saving your icons"],
    completed: ["生成完成", "Generation complete"],
  };
  const allVariants = useMemo(
    () => job.subjects.flatMap((subject) => subject.variants),
    [job],
  );
  useEffect(() => {
    if (requestedInitialAssets.current) return;
    const needsAssets = allVariants.some(
      (variant) => variant.status === "completed" && !variant.previewUrl,
    );
    if (!needsAssets) return;
    const timer = window.setTimeout(async () => {
      if (requestedInitialAssets.current) return;
      requestedInitialAssets.current = true;
      try {
        const response = await fetch(`/api/generation/jobs/${job.id}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load generated assets");
        setJob(await response.json());
        setLastUpdatedAt(Date.now());
      } catch {
        requestedInitialAssets.current = false;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [allVariants, job.id]);
  const available = useMemo(
    () =>
      allVariants.filter(
        (variant) =>
          (variant.status === "completed" ||
            Boolean(variant.previewUrl && variant.assets.length > 0)) &&
          (variant.previewUrl ||
            variant.assets.some((asset) => asset.previewUrl)),
      ),
    [allVariants],
  );
  const resultPreviewUrls = useMemo(
    () =>
      allVariants.flatMap((variant) => {
        const largest = variant.assets.reduce<
          (typeof variant.assets)[number] | undefined
        >(
          (current, asset) =>
            !current || asset.size > current.size ? asset : current,
          undefined,
        );
        const source = variant.previewUrl ?? largest?.previewUrl;
        return source ? [source] : [];
      }),
    [allVariants],
  );
  const resultPreviewsReady =
    resultPreviewUrls.length > 0 &&
    resultPreviewUrls.every((source) => settledPreviewUrls.has(source));
  function markPreviewSettled(source: string) {
    setSettledPreviewUrls((current) => {
      if (current.has(source)) return current;
      const next = new Set(current);
      next.add(source);
      return next;
    });
  }
  const allAvailableSelected =
    available.length > 0 &&
    available.every((variant) => selected.has(variant.id));
  const supportsSvgDownload =
    job.purpose === "interaction" &&
    available.some((variant) => Boolean(variant.vectorUrl));
  const completedVariants = allVariants.filter(
    (variant) =>
      variant.status === "completed" ||
      Boolean(variant.previewUrl && variant.assets.length > 0),
  ).length;
  const effectiveJobStatus =
    allVariants.length > 0 && completedVariants === allVariants.length
      ? "completed"
      : job.status;
  const processingVariant = allVariants.find(
    (variant) => variant.status === "processing",
  );
  const secondsSinceUpdate = Math.max(
    0,
    Math.floor((now - lastUpdatedAt) / 1000),
  );
  const generationStalled = isGenerationStalled(job, now);
  const pollingUnavailable = hasRepeatedPollingFailures(pollFailureCount);
  const variantStatusLabels: Record<string, [string, string]> = {
    queued: ["等待生成", "Waiting"],
    processing: ["正在生成", "Generating"],
    completed: ["已完成", "Complete"],
    failed: ["生成失败", "Could not generate"],
  };
  function toggle(id: string) {
    const update = () =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    const documentWithTransitions = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (documentWithTransitions.startViewTransition)
      documentWithTransitions.startViewTransition(update);
    else update();
  }
  async function retryVariant(variantId: string) {
    setRevealedDuringGeneration(true);
    setRetrying((current) => new Set(current).add(variantId));
    setMessage("");
    try {
      const response = await fetch(
        `/api/generation/variants/${variantId}/retry`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Regeneration failed");
      }
      setJob((current) => ({
        ...current,
        status: "queued",
        progress: { ...current.progress, phase: "queued" },
        subjects: current.subjects.map((subject) => ({
          ...subject,
          variants: subject.variants.map((variant) =>
            variant.id === variantId
              ? { ...variant, status: "queued", errorCode: undefined }
              : variant,
          ),
        })),
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "zh"
            ? "重新生成失败，请稍后重试。"
            : "Regeneration failed. Try again.",
      );
    } finally {
      setRetrying((current) => {
        const next = new Set(current);
        next.delete(variantId);
        return next;
      });
    }
  }
  async function downloadZip() {
    if (selected.size === 0) {
      setMessage(
        locale === "zh"
          ? "请至少选择一个要下载的方案。"
          : "Select at least one option to download.",
      );
      return;
    }
    setDownloading(true);
    setMessage("");
    try {
      const selectedVariants = allVariants.filter((item) =>
        selected.has(item.id),
      );
      if (includeSvg && selectedVariants.some((item) => !item.vectorUrl))
        throw new Error(
          locale === "zh"
            ? "所选方案中有暂不支持 SVG 的图标。"
            : "One or more selected options do not support SVG.",
        );
      const response = await fetch(`/api/generation/jobs/${job.id}/downloads`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variantIds: [...selected],
          format: "png",
          includeSvg,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Download failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `easy-design-${job.id}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "zh"
            ? "打包下载失败，请稍后重试。"
            : "The ZIP could not be created. Try again.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const phase =
    phaseLabels[job.progress.phase]?.[locale === "zh" ? 0 : 1] ??
    job.progress.phase;
  function goBack() {
    // `document.referrer` is not updated by Next.js client navigation, so it
    // incorrectly treated a real list → details transition as a direct visit
    // and issued a fresh `/icons` request. Prefer the existing history entry;
    // Next can then restore its cached list tree and filters immediately.
    sessionStorage.setItem("icongen:refresh-job", job.id);
    const returnHref = sessionStorage.getItem("icongen:icons-return-href");
    if (returnHref?.startsWith("/icons")) {
      sessionStorage.removeItem("icongen:icons-return-href");
      router.replace(returnHref);
      return;
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/icons");
  }
  if (editing) {
    return (
      <VariantEditDialog
        variant={editing.variant}
        subjectName={editing.subjectName}
        locale={locale}
        onClose={() => setEditing(null)}
        onChanged={refreshJob}
      />
    );
  }
  return (
    <div className="icon-results-studio space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          className="studio-button studio-button--secondary inline-flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-sm font-bold"
        >
          <span aria-hidden="true">←</span>
          {locale === "zh" ? "返回上一页" : "Back"}
        </button>
        <div className="ml-auto mr-6 flex min-w-0 items-center justify-end gap-3 text-right sm:mr-10">
          <h1 className="truncate text-2xl font-black tracking-[-.03em] text-foreground sm:text-3xl">
            {locale === "zh" ? "图标详情" : "Icon details"}
          </h1>
          {effectiveJobStatus !== "completed" ? (
            <StatusBadge status={effectiveJobStatus} />
          ) : null}
        </div>
      </div>
      {effectiveJobStatus !== "completed" ? (
        <section aria-live="polite" className="studio-panel p-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full bg-brand ${finished.has(job.status) ? "" : "animate-pulse"}`}
              />
              <b>
                {processingVariant
                  ? locale === "zh"
                    ? `正在生成方案 ${processingVariant.slot}`
                    : `Generating option ${processingVariant.slot}`
                  : phase}
              </b>
            </div>
            <span>
              {locale === "zh"
                ? `${allVariants.length} 个方案中已完成 ${completedVariants} 个`
                : `${completedVariants} of ${allVariants.length} options ready`}
            </span>
          </div>
          <div className="draft-progress mt-3 h-3">
            <div
              className={`draft-progress__fill h-full bg-brand transition-[width] duration-500 ${finished.has(job.status) ? "" : "is-active"}`}
              style={{ width: `${job.progress.percent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span>
              {job.progress.currentSubjectName
                ? locale === "zh"
                  ? `正在生成：${job.progress.currentSubjectName}`
                  : `Generating: ${job.progress.currentSubjectName}`
                : phase}
            </span>
            {finished.has(job.status) ? null : (
              <span>
                {isRefreshing
                  ? locale === "zh"
                    ? "正在同步…"
                    : "Syncing…"
                  : locale === "zh"
                    ? `${secondsSinceUpdate} 秒前更新`
                    : `Updated ${secondsSinceUpdate}s ago`}
              </span>
            )}
          </div>
        </section>
      ) : null}
      {!finished.has(job.status) &&
      (generationStalled || pollingUnavailable) ? (
        <section
          role="alert"
          className="studio-notice studio-notice--warning p-4 text-sm"
        >
          <b>
            {locale === "zh"
              ? pollingUnavailable
                ? "暂时无法获取最新生成状态"
                : "生成时间超过预期"
              : pollingUnavailable
                ? "Unable to retrieve the latest status"
                : "Generation is taking longer than expected"}
          </b>
          <p className="mt-1 leading-6">
            {locale === "zh"
              ? pollingUnavailable
                ? "页面会继续自动重试。请检查网络，或稍后手动刷新状态。"
                : "图片服务可能暂时繁忙或不可用。任务仍会在后台处理；如果最终生成失败，消耗的点数会自动返还。"
              : pollingUnavailable
                ? "This page will keep retrying automatically. Check your connection or refresh the status later."
                : "The image service may be busy or temporarily unavailable. Processing continues in the background, and credits are returned automatically if generation ultimately fails."}
          </p>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => void refreshStatusNow()}
            className="studio-button studio-button--secondary focus-ring mt-3 px-3 py-2 font-bold disabled:cursor-wait disabled:opacity-50"
          >
            {isRefreshing
              ? locale === "zh"
                ? "正在刷新…"
                : "Refreshing…"
              : locale === "zh"
                ? "刷新状态"
                : "Refresh status"}
          </button>
        </section>
      ) : null}
      <div className="space-y-8">
        {job.subjects.map((subject) => (
          <section key={subject.id} className="studio-panel p-5">
            <div className="mb-4">
              <h2 className="text-xl font-black">{subject.name}</h2>
              {subject.description !== subject.name ? (
                <p className="mt-1 text-sm text-muted">{subject.description}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {subject.variants.map((variant) => {
                const asset = variant.assets.reduce<
                  (typeof variant.assets)[number] | undefined
                >(
                  (largest, item) =>
                    !largest || item.size > largest.size ? item : largest,
                  undefined,
                );
                const previewUrl = variant.previewUrl ?? asset?.previewUrl;
                const effectiveStatus =
                  previewUrl && variant.assets.length > 0
                    ? "completed"
                    : variant.status;
                const chosen = selected.has(variant.id);
                const statusLabel =
                  variantStatusLabels[effectiveStatus]?.[
                    locale === "zh" ? 0 : 1
                  ] ?? effectiveStatus;
                const isRetrying = retrying.has(variant.id);
                return (
                  <article
                    key={variant.id}
                    data-selected={chosen || undefined}
                    data-status={effectiveStatus}
                    className={`studio-result-card relative p-3 transition-colors is-${effectiveStatus} ${chosen ? "is-selected" : ""}`}
                  >
                    {chosen ? (
                      <span
                        aria-hidden="true"
                        className="studio-selection-check absolute -left-2 -top-2 z-20"
                        style={{ viewTransitionName: "studio-selection-check" }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="block h-4 w-4 fill-none stroke-current"
                          strokeWidth="2.2"
                          strokeLinecap="square"
                          strokeLinejoin="miter"
                        >
                          <path d="m4.5 12.5 5 5 10-10" />
                        </svg>
                      </span>
                    ) : null}
                    <div
                      className={`studio-result-preview group/preview relative grid aspect-square place-items-center overflow-hidden rounded-xl bg-transparent is-${effectiveStatus}`}
                    >
                      <button
                        type="button"
                        disabled={effectiveStatus !== "completed"}
                        aria-pressed={chosen}
                        aria-label={
                          locale === "zh"
                            ? `选择方案 ${variant.slot}`
                            : `Select option ${variant.slot}`
                        }
                        onClick={() => toggle(variant.id)}
                        className="absolute inset-0 z-10 disabled:cursor-default"
                      />
                      {previewUrl ? (
                        <ImageWithSkeleton
                          src={previewUrl}
                          alt={`${subject.name} option ${variant.slot}`}
                          className="h-full w-full"
                          reveal={shouldRevealGenerationPreview({
                            revealedDuringGeneration: revealedDuringGeneration,
                            allPreviewsReady: resultPreviewsReady,
                            currentPreviewSettled:
                              settledPreviewUrls.has(previewUrl),
                          })}
                          onLoad={() => markPreviewSettled(previewUrl)}
                          onError={() => markPreviewSettled(previewUrl)}
                          failureLabel={
                            locale === "zh" ? "加载失败" : "Failed to load"
                          }
                        />
                      ) : effectiveStatus === "completed" ? (
                        <SkeletonBlock className="h-full w-full rounded-xl" />
                      ) : (
                        <div className="grid place-items-center gap-3 text-sm text-muted">
                          {effectiveStatus === "processing" ? (
                            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
                          ) : null}
                          <span>{statusLabel}</span>
                        </div>
                      )}
                      {previewUrl && effectiveStatus === "completed" ? (
                        <button
                          type="button"
                          aria-label={
                            locale === "zh"
                              ? `预览方案 ${variant.slot} 大图`
                              : `Preview option ${variant.slot}`
                          }
                          title={
                            locale === "zh" ? "预览大图" : "Preview full size"
                          }
                          onClick={() =>
                            setPreviewing({
                              src: previewUrl,
                              alt: `${subject.name} option ${variant.slot}`,
                            })
                          }
                          className="focus-ring absolute right-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#151515]/90 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 backdrop-blur-md transition-opacity duration-150 group-hover/preview:opacity-100 group-focus-within/preview:opacity-100 focus-visible:opacity-100"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="size-3.5 fill-none stroke-current"
                            strokeWidth="2"
                          >
                            <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />
                          </svg>
                          {locale === "zh" ? "预览" : "Preview"}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={effectiveStatus !== "completed"}
                      aria-pressed={chosen}
                      onClick={() => toggle(variant.id)}
                      className="block w-full text-left disabled:cursor-default"
                    >
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <b>
                          {locale === "zh"
                            ? `方案 ${variant.slot}`
                            : `Option ${variant.slot}`}
                        </b>
                        <span
                          className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${effectiveStatus === "processing" ? "border-[#363636] bg-[#252525] text-[#a9bbff]" : "border-border bg-surface-muted text-muted"}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </button>
                    {effectiveStatus === "failed" ? (
                      <button
                        type="button"
                        disabled={isRetrying}
                        onClick={() => void retryVariant(variant.id)}
                        className="studio-button studio-button--secondary mt-3 w-full px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                      >
                        {isRetrying
                          ? locale === "zh"
                            ? "正在重新生成…"
                            : "Regenerating…"
                          : locale === "zh"
                            ? "重新生成此方案"
                            : "Try this option again"}
                      </button>
                    ) : null}
                    {effectiveStatus === "completed" && Boolean(previewUrl) ? (
                      <div className="mt-3 flex items-stretch gap-2 overflow-visible">{job.supportsVariantEditing ? <button
                          type="button"
                          onClick={() => setEditing({ variant, subjectName: subject.name })}
                          className="studio-button studio-button--secondary relative z-[1] min-w-0 basis-0 flex-1 shrink-0 px-4 py-2.5 text-sm font-bold"
                        >{locale === "zh" ? "细节调整" : "Adjust details"}</button> : <span className="flex-1" />}<FavoriteToggle placement="action" item={{ variantId: variant.id, jobId: job.id, subjectName: subject.name, slot: variant.slot, previewUrl: previewUrl! }} /></div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {available.length > 0 ? (
        <div className="studio-panel sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 p-4">
          <p className="text-sm font-semibold">
            {locale === "zh"
              ? `已选择 ${selected.size} 个方案 · 包含原图和全部尺寸 PNG`
              : `${selected.size} options · original and all PNG sizes included`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  allAvailableSelected
                    ? new Set()
                    : new Set(available.map((variant) => variant.id)),
                )
              }
              className="studio-button studio-button--secondary px-4 py-3 text-sm font-bold"
            >
              {allAvailableSelected
                ? locale === "zh"
                  ? "取消全选"
                  : "Clear all"
                : locale === "zh"
                  ? "全选"
                  : "Select all"}
            </button>
            {supportsSvgDownload ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-[#222226] px-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={includeSvg}
                  onChange={(event) => setIncludeSvg(event.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                <span>{locale === "zh" ? "包含 SVG" : "Include SVG"}</span>
              </label>
            ) : null}
            <button
              type="button"
              onClick={downloadZip}
              disabled={downloading}
              className="studio-button studio-button--primary px-5 py-3 text-sm font-black disabled:opacity-50"
            >
              {downloading
                ? locale === "zh"
                  ? "正在准备下载…"
                  : "Preparing download…"
                : locale === "zh"
                  ? "下载所选内容"
                  : "Download selected"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <Toast message={message} variant="error" />
      ) : null}
      {previewing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={locale === "zh" ? "方案大图预览" : "Option preview"}
          className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-8"
        >
          <button
            type="button"
            aria-label={locale === "zh" ? "关闭预览" : "Close preview"}
            onClick={() => setPreviewing(null)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="studio-panel relative z-10 flex max-h-[78vh] w-full max-w-[680px] flex-col overflow-hidden p-3 sm:p-4">
            <button
              type="button"
              aria-label={locale === "zh" ? "关闭预览" : "Close preview"}
              onClick={() => setPreviewing(null)}
              className="focus-ring absolute right-5 top-5 z-20 grid size-9 place-items-center rounded-xl border border-border bg-[#252525] text-xl font-bold text-foreground hover:bg-[#2b2b2b]"
            >
              ×
            </button>
            <ImageWithSkeleton
              src={previewing.src}
              alt={previewing.alt}
              loading="eager"
              className="aspect-square max-h-[calc(78vh-2rem)] w-full rounded-xl bg-transparent"
              imageClassName="object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function hydrateCachedPreviews(initialJob: GenerationJobV2): GenerationJobV2 {
  if (typeof window === "undefined") return initialJob;
  const cacheKey = `icongen:job-previews:${initialJob.id}`;
  try {
    const cached = JSON.parse(
      sessionStorage.getItem(cacheKey) ?? "[]",
    ) as unknown;
    if (!Array.isArray(cached)) return initialJob;
    const previewUrls = cached.filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    if (!previewUrls.length) return initialJob;
    let previewIndex = 0;
    return {
      ...initialJob,
      subjects: initialJob.subjects.map((subject) => ({
        ...subject,
        variants: subject.variants.map((variant) => {
          if (
            variant.previewUrl ||
            variant.status !== "completed" ||
            previewIndex >= previewUrls.length
          ) {
            return variant;
          }
          return { ...variant, previewUrl: previewUrls[previewIndex++] };
        }),
      })),
    };
  } catch {
    sessionStorage.removeItem(cacheKey);
    return initialJob;
  }
}
