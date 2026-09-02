"use client";
/* eslint-disable @next/next/no-img-element -- previews use short-lived private signed URLs */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GenerationJobV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { VariantEditDialog } from "./variant-edit-dialog";

const finished = new Set(["completed", "partial", "failed"]);

export function JobDetails({ initialJob }: { initialJob: GenerationJobV2 }) {
  const { locale } = useLocale();
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [includeSvg, setIncludeSvg] = useState(false);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<{
    variant: GenerationJobV2["subjects"][number]["variants"][number];
    subjectName: string;
  } | null>(null);

  async function refreshJob() {
    const response = await fetch(`/api/generation/jobs/${job.id}`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        locale === "zh"
          ? "无法刷新生成结果。"
          : "Could not refresh generation results.",
      );
    setJob(await response.json());
    setLastUpdatedAt(Date.now());
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
          setJob(await response.json());
          setLastUpdatedAt(Date.now());
        }
      } catch {
        /* keep the last known progress and retry */
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
  const allAvailableSelected =
    available.length > 0 &&
    available.every((variant) => selected.has(variant.id));
  const supportsSvgDownload = available.some((variant) =>
    Boolean(variant.vectorUrl),
  );
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
  const variantStatusLabels: Record<string, [string, string]> = {
    queued: ["等待生成", "Waiting"],
    processing: ["正在生成", "Generating"],
    completed: ["已完成", "Complete"],
    failed: ["生成失败", "Could not generate"],
  };
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function retryVariant(variantId: string) {
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
      anchor.download = `bamboo-icongen-${job.id}.zip`;
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={goBack}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold transition-colors hover:border-brand hover:text-brand"
          >
            <span aria-hidden="true">←</span>
            {locale === "zh" ? "返回上一页" : "Back"}
          </button>
          <h1 className="text-3xl font-black tracking-[-.03em] text-foreground">
            {locale === "zh" ? "生成结果" : "Generation results"}
          </h1>
        </div>
        {effectiveJobStatus !== "completed" ? (
          <StatusBadge status={effectiveJobStatus} />
        ) : null}
      </div>
      {effectiveJobStatus !== "completed" ? (
        <section
          aria-live="polite"
          className="rounded-2xl border border-border bg-surface p-5"
        >
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
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
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
      <div className="space-y-8">
        {job.subjects.map((subject) => (
          <section
            key={subject.id}
            className="rounded-[24px] border border-border bg-surface p-5"
          >
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
                    className={`rounded-2xl border p-3 transition ${chosen ? "border-brand shadow-[0_0_0_2px_#6750E8]" : effectiveStatus === "processing" ? "border-brand/60" : "border-border"}`}
                  >
                    <button
                      type="button"
                      disabled={effectiveStatus !== "completed"}
                      onClick={() => toggle(variant.id)}
                      className="block w-full text-left disabled:cursor-default"
                    >
                      <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-surface-muted">
                        {previewUrl ? (
                          <ImageWithSkeleton
                            src={previewUrl}
                            alt={`${subject.name} option ${variant.slot}`}
                            className="h-full w-full"
                            failureLabel={locale === "zh" ? "加载失败" : "Failed to load"}
                          />
                        ) : (
                          <div className="grid place-items-center gap-3 text-sm text-muted">
                            {effectiveStatus === "processing" ? (
                              <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
                            ) : null}
                            <span>{statusLabel}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <b>
                          {locale === "zh"
                            ? `方案 ${variant.slot}`
                            : `Option ${variant.slot}`}
                        </b>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-bold ${effectiveStatus === "processing" ? "bg-brand/10 text-brand" : "bg-surface-muted text-muted"}`}
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
                        className="mt-3 w-full rounded-xl border border-brand px-4 py-2.5 text-sm font-bold text-brand disabled:opacity-50"
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
                    {job.supportsVariantEditing &&
                    effectiveStatus === "completed" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({ variant, subjectName: subject.name })
                        }
                        className="mt-3 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:border-brand hover:text-brand"
                      >
                        {locale === "zh" ? "细节调整" : "Adjust details"}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {available.length > 0 ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur">
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
              className="rounded-xl border border-border px-4 py-3 text-sm font-bold"
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
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-bold">
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
              className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white disabled:opacity-50"
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
        <p
          role="alert"
          className="rounded-xl bg-[#fff1ed] p-4 text-sm text-danger"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
