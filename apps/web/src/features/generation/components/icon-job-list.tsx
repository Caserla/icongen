"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import type { GenerationJobListItem } from "@/features/generation/server/generation-job-list-reader";

export function IconJobList({ jobs }: { jobs: GenerationJobListItem[] }) {
  const { locale } = useLocale();
  return <div><p className="text-xs font-black uppercase tracking-[.16em] text-brand">{locale === "zh" ? "工作空间" : "Workspace"}</p><h1 className="display-serif mt-2 text-4xl font-medium tracking-[-.045em] sm:text-5xl">{locale === "zh" ? "我的图标" : "My Icons"}</h1><p className="mt-3 max-w-2xl leading-7 text-muted">{locale === "zh" ? "在这里查看已完成、生成中和失败的图标集。" : "Find completed, in-progress, and failed icon sets here."}</p>{jobs.length === 0 ? <section className="mt-8 rounded-[20px] border border-dashed border-border p-8 text-center"><p className="font-bold">{locale === "zh" ? "还没有图标集" : "No icon sets yet"}</p><Link href="/create" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">{locale === "zh" ? "创建第一套图标" : "Create your first icon set"}</Link></section> : <section className="mt-8 grid gap-4">{jobs.map((job) => <Link key={job.id} href={`/icons/${job.id}`} className="focus-ring flex items-center justify-between gap-5 rounded-[20px] border border-border p-5 transition hover:border-brand"><div><p className="font-black">{job.subjects.map((subject) => subject.name).join(locale === "zh" ? "、" : ", ") || (locale === "zh" ? "未命名图标集" : "Untitled icon set")}</p><p className="mt-1 text-sm text-muted">{job.subjects.length} {locale === "zh" ? "个图标主体" : "icon subjects"} · {new Date(job.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</p></div><StatusBadge status={job.status}/></Link>)}</section>}</div>;
}
