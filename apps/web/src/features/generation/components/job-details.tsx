"use client";

import type { GenerationJobV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

const subjectZh: Record<string, { name: string; description: string }> = {
  add: { name: "新增", description: "新增一个项目" },
  search: { name: "查找", description: "查找已有项目" },
  delete: { name: "删除", description: "安全删除一个项目" },
};

export function JobDetails({ job }: { job: GenerationJobV2 }) {
  const { locale, t } = useLocale();
  const phaseLabels: Record<string, string> = { completed: "已完成", generating: "正在生成", queued: "排队中", processing: "处理中" };
  const phase = locale === "zh" ? (phaseLabels[job.progress.phase] ?? job.progress.phase) : job.progress.phase;
  return <div className="space-y-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageHeader eyebrow={t("generationJob")} title={locale === "zh" ? `${job.subjects.length} ${t("iconSubjects")} · ${t("threeEach")}` : `${job.subjects.length} ${t("iconSubjects")} · ${t("threeEach")}`} description={`${job.progress.percent}% · ${phase}`} />
      <StatusBadge status={job.status} />
    </div>
    {job.status === "completed" ? <div className="space-y-8">{job.subjects.map((subject) => {
      const translated = locale === "zh" ? subjectZh[subject.clientId] : undefined;
      return <section key={subject.id}><h2 className="mb-3 text-lg font-black">{translated?.name ?? subject.name}</h2><p className="mb-4 text-sm text-muted">{translated?.description ?? subject.description}</p><div className="grid gap-5 sm:grid-cols-3">{subject.variants.map((variant) => <Card key={variant.id}><div className="grid aspect-square place-items-center rounded-3xl bg-surface-muted text-5xl font-black text-brand">{variant.slot}</div><div className="mt-5 flex items-center justify-between"><span className="font-semibold">{t("direction")} {variant.slot}</span><ButtonLink href={variant.assets[0]?.previewUrl ?? "#"} variant="secondary">{t("downloadPng")}</ButtonLink></div></Card>)}</div></section>;
    })}</div> : <Card><p className="font-semibold">{t("creatingIcons")}</p><p className="mt-2 text-sm text-muted">{t("leaveAndReturn")}</p></Card>}
  </div>;
}
