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

  useEffect(() => {
    if (finished.has(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/generation/jobs/${job.id}`, { cache: "no-store" });
        if (response.ok) setJob(await response.json());
      } catch { /* keep the last known progress and retry */ }
    }, document.hidden ? 8000 : 2500);
    return () => window.clearInterval(timer);
  }, [job.id, job.status]);

  const phaseLabels: Record<string, [string,string]> = {
    queued: ["等待开始", "Waiting to start"], compiling: ["正在整理设计要求", "Preparing the design brief"],
    generating: ["正在生成图标", "Generating icons"], "processing-assets": ["正在处理图标文件", "Processing icon files"],
    saving: ["正在保存结果", "Saving results"], completed: ["生成完成", "Generation complete"],
  };
  const available = useMemo(() => job.subjects.flatMap((subject) => subject.variants.filter((variant) => variant.status === "completed" && variant.assets[0]?.previewUrl)), [job]);
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  async function downloadZip() {
    if (selected.size === 0) { setMessage(locale === "zh" ? "请先选择至少一个图标方案。" : "Select at least one icon variant first."); return; }
    setDownloading(true); setMessage("");
    try {
      const variant = job.subjects.flatMap((subject) => subject.variants).find((item) => selected.has(item.id));
      const size = variant?.assets[0]?.size; if (!size) throw new Error("No downloadable size is ready.");
      const response = await fetch(`/api/generation/jobs/${job.id}/downloads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantIds: [...selected], size }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.message ?? "Download failed"); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bamboo-icongen-${job.id}.zip`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : (locale === "zh" ? "打包下载失败，请稍后重试。" : "The ZIP could not be created. Try again.")); }
    finally { setDownloading(false); }
  }

  async function markPrimary(subjectId: string, variantId: string) {
    const response = await fetch(`/api/generation/subjects/${subjectId}/primary`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantId }) });
    if (!response.ok) { setMessage(locale === "zh" ? "首选方案保存失败。" : "The preferred variant could not be saved."); return; }
    setJob((current) => ({ ...current, subjects: current.subjects.map((subject) => subject.id !== subjectId ? subject : { ...subject, variants: subject.variants.map((variant) => ({ ...variant, isPrimary: variant.id === variantId })) }) }));
  }

  const phase = phaseLabels[job.progress.phase]?.[locale === "zh" ? 0 : 1] ?? job.progress.phase;
  return <div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader eyebrow={locale === "zh" ? "生成结果" : "Generation results"} title={locale === "zh" ? `${job.subjects.length} 个图标 · 每个 3 种备选方案` : `${job.subjects.length} icons · 3 variants each`} description={`${job.progress.percent}% · ${phase}`} /><StatusBadge status={job.status}/></div>
    <section aria-live="polite" className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-4 text-sm"><b>{phase}</b><span>{job.progress.completedSubjects} / {job.progress.totalSubjects}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${job.progress.percent}%` }}/></div>{job.progress.currentSubjectName ? <p className="mt-3 text-sm text-muted">{locale === "zh" ? `正在处理：${job.progress.currentSubjectName}` : `Working on: ${job.progress.currentSubjectName}`}</p> : null}</section>
    <div className="space-y-8">{job.subjects.map((subject) => <section key={subject.id} className="rounded-[24px] border border-border bg-surface p-5"><div className="mb-4"><h2 className="text-xl font-black">{subject.name}</h2><p className="mt-1 text-sm text-muted">{subject.description}</p></div><div className="grid gap-4 sm:grid-cols-3">{subject.variants.map((variant) => { const asset = variant.assets[0]; const chosen = selected.has(variant.id); return <article key={variant.id} className={`rounded-2xl border p-3 transition ${chosen ? "border-brand shadow-[0_0_0_2px_#6750E8]" : "border-border"}`}><button type="button" disabled={variant.status !== "completed"} onClick={() => toggle(variant.id)} className="block w-full text-left disabled:cursor-default"><div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-surface-muted">{asset?.previewUrl ? <img src={asset.previewUrl} alt={`${subject.name} variant ${variant.slot}`} className="h-full w-full object-contain"/> : <span className="text-sm text-muted">{variant.status === "failed" ? (locale === "zh" ? "生成失败" : "Failed") : `${locale === "zh" ? "方案" : "Variant"} ${variant.slot}`}</span>}</div><div className="mt-3 flex items-center justify-between"><b>{locale === "zh" ? `方案 ${variant.slot}` : `Variant ${variant.slot}`}</b><span className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${chosen ? "border-brand bg-brand text-white" : "border-border"}`}>{chosen ? "✓" : ""}</span></div></button>{asset?.previewUrl ? <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => markPrimary(subject.id, variant.id)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${variant.isPrimary ? "border-brand bg-brand text-white" : "border-border"}`}>{variant.isPrimary ? (locale === "zh" ? "已标记" : "Preferred") : (locale === "zh" ? "标记首选" : "Mark preferred")}</button><a href={asset.previewUrl} download={`${subject.name}-variant-${variant.slot}-${asset.size}.png`} className="rounded-xl border border-border px-2 py-2 text-center text-xs font-bold">{locale === "zh" ? "单图下载" : "Download"}</a></div> : null}</article>; })}</div></section>)}</div>
    {available.length > 0 ? <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur"><p className="text-sm font-semibold">{locale === "zh" ? `已选择 ${selected.size} 个方案` : `${selected.size} variants selected`}</p><div className="flex gap-2"><button type="button" onClick={() => setSelected(new Set(available.map((variant) => variant.id)))} className="rounded-xl border border-border px-4 py-3 text-sm font-bold">{locale === "zh" ? "全选" : "Select all"}</button><button type="button" onClick={downloadZip} disabled={downloading} className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white disabled:opacity-50">{downloading ? (locale === "zh" ? "正在打包…" : "Creating ZIP…") : (locale === "zh" ? "打包下载选中图标" : "Download selected ZIP")}</button></div></div> : null}
    {message ? <p role="alert" className="rounded-xl bg-[#fff1ed] p-4 text-sm text-danger">{message}</p> : null}
  </div>;
}
