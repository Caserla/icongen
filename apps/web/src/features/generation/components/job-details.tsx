"use client";
/* eslint-disable @next/next/no-img-element -- previews use short-lived private signed URLs */

import { useEffect, useMemo, useState } from "react";
import type { GenerationJobV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

const finished = new Set(["completed", "partial", "failed"]);

export function JobDetails({ initialJob }: { initialJob: GenerationJobV2 }) {
  const { locale } = useLocale();
  const [job, setJob] = useState(initialJob);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finished.has(job.status)) return;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch(`/api/generation/jobs/${job.id}`, { cache: "no-store" });
        if (response.ok && !cancelled) {
          setJob(await response.json());
          setLastUpdatedAt(Date.now());
        }
      } catch { /* keep the last known progress and retry */ }
      finally {
        if (!cancelled) {
          setIsRefreshing(false);
          timer = window.setTimeout(refresh, document.hidden ? 8000 : 2500);
        }
      }
    };
    void refresh();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [job.id, job.status]);

  useEffect(() => {
    if (finished.has(job.status)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [job.status]);

  const phaseLabels: Record<string, [string,string]> = {
    queued: ["等待开始", "Waiting to start"], compiling: ["正在整理设计要求", "Preparing the design brief"],
    generating: ["正在生成图标", "Generating icons"], "processing-assets": ["正在处理图标文件", "Processing icon files"],
    saving: ["正在保存结果", "Saving results"], completed: ["生成完成", "Generation complete"],
  };
  const available = useMemo(() => job.subjects.flatMap((subject) => subject.variants.filter((variant) => variant.status === "completed" && (variant.previewUrl || variant.assets.some((asset) => asset.previewUrl)))), [job]);
  const allVariants = useMemo(() => job.subjects.flatMap((subject) => subject.variants), [job]);
  const completedVariants = allVariants.filter((variant) => variant.status === "completed").length;
  const processingVariant = allVariants.find((variant) => variant.status === "processing");
  const secondsSinceUpdate = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  const variantStatusLabels: Record<string, [string, string]> = {
    queued: ["等待生成", "Waiting"], processing: ["正在生成", "Generating"],
    completed: ["已完成", "Complete"], failed: ["生成失败", "Failed"],
  };
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function downloadZip() {
    if (selected.size === 0) { setMessage(locale === "zh" ? "请先选择至少一个图标方案。" : "Select at least one icon variant first."); return; }
    setDownloading(true); setMessage("");
    try {
      const variant = job.subjects.flatMap((subject) => subject.variants).find((item) => selected.has(item.id));
      const size = variant?.assets.reduce((largest, asset) => Math.max(largest, asset.size), 0); if (!size) throw new Error("No downloadable size is ready.");
      const response = await fetch(`/api/generation/jobs/${job.id}/downloads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantIds: [...selected], size }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.message ?? "Download failed"); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bamboo-icongen-${job.id}.zip`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : (locale === "zh" ? "打包下载失败，请稍后重试。" : "The ZIP could not be created. Try again.")); }
    finally { setDownloading(false); }
  }

  const phase = phaseLabels[job.progress.phase]?.[locale === "zh" ? 0 : 1] ?? job.progress.phase;
  return <div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader eyebrow={locale === "zh" ? "生成结果" : "Generation results"} title={locale === "zh" ? `${job.subjects.length} 个图标 · 每个 3 种备选方案` : `${job.subjects.length} icons · 3 variants each`} description={`${job.progress.percent}% · ${phase}`} /><StatusBadge status={job.status}/></div>
    <section aria-live="polite" className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-4 text-sm"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full bg-brand ${finished.has(job.status) ? "" : "animate-pulse"}`}/><b>{processingVariant ? (locale === "zh" ? `正在生成方案 ${processingVariant.slot}` : `Generating variant ${processingVariant.slot}`) : phase}</b></div><span>{locale === "zh" ? `已完成 ${completedVariants} / ${allVariants.length} 个方案` : `${completedVariants} / ${allVariants.length} variants complete`}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${job.progress.percent}%` }}/></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted"><span>{job.progress.currentSubjectName ? (locale === "zh" ? `正在处理：${job.progress.currentSubjectName}` : `Working on: ${job.progress.currentSubjectName}`) : phase}</span>{finished.has(job.status) ? null : <span>{isRefreshing ? (locale === "zh" ? "正在同步…" : "Syncing…") : (locale === "zh" ? `${secondsSinceUpdate} 秒前更新` : `Updated ${secondsSinceUpdate}s ago`)}</span>}</div></section>
    <div className="space-y-8">{job.subjects.map((subject) => <section key={subject.id} className="rounded-[24px] border border-border bg-surface p-5"><div className="mb-4"><h2 className="text-xl font-black">{subject.name}</h2><p className="mt-1 text-sm text-muted">{subject.description}</p></div><div className="grid gap-4 sm:grid-cols-3">{subject.variants.map((variant) => { const asset = variant.assets.reduce<(typeof variant.assets)[number] | undefined>((largest, item) => !largest || item.size > largest.size ? item : largest, undefined); const previewUrl = variant.previewUrl ?? asset?.previewUrl; const chosen = selected.has(variant.id); const statusLabel = variantStatusLabels[variant.status]?.[locale === "zh" ? 0 : 1] ?? variant.status; return <article key={variant.id} className={`rounded-2xl border p-3 transition ${chosen ? "border-brand shadow-[0_0_0_2px_#6750E8]" : variant.status === "processing" ? "border-brand/60" : "border-border"}`}><button type="button" disabled={variant.status !== "completed"} onClick={() => toggle(variant.id)} className="block w-full text-left disabled:cursor-default"><div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-surface-muted">{previewUrl ? <img src={previewUrl} alt={`${subject.name} variant ${variant.slot}`} className="h-full w-full object-contain"/> : <div className="grid place-items-center gap-3 text-sm text-muted">{variant.status === "processing" ? <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand/25 border-t-brand"/> : null}<span>{statusLabel}</span></div>}</div><div className="mt-3 flex items-center justify-between gap-2"><b>{locale === "zh" ? `方案 ${variant.slot}` : `Variant ${variant.slot}`}</b><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${variant.status === "processing" ? "bg-brand/10 text-brand" : "bg-surface-muted text-muted"}`}>{statusLabel}</span></div></button></article>; })}</div></section>)}</div>
    {available.length > 0 ? <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur"><p className="text-sm font-semibold">{locale === "zh" ? `已选择 ${selected.size} 个方案` : `${selected.size} variants selected`}</p><div className="flex gap-2"><button type="button" onClick={() => setSelected(new Set(available.map((variant) => variant.id)))} className="rounded-xl border border-border px-4 py-3 text-sm font-bold">{locale === "zh" ? "全选" : "Select all"}</button><button type="button" onClick={downloadZip} disabled={downloading} className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white disabled:opacity-50">{downloading ? (locale === "zh" ? "正在打包…" : "Creating ZIP…") : (locale === "zh" ? "打包下载选中图标" : "Download selected ZIP")}</button></div></div> : null}
    {message ? <p role="alert" className="rounded-xl bg-[#fff1ed] p-4 text-sm text-danger">{message}</p> : null}
  </div>;
}
