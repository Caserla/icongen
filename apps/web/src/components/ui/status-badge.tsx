"use client";
import type { GenerationJobStatusV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";

const styles: Record<GenerationJobStatusV2, string> = {
  queued: "bg-slate-100 text-slate-700",
  processing: "bg-blue-50 text-blue-700",
  completed: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: GenerationJobStatusV2 }) {
  const { locale } = useLocale();
  const labels: Record<GenerationJobStatusV2, string> = locale === "zh" ? { queued: "排队中", processing: "生成中", completed: "已完成", partial: "部分完成", failed: "失败" } : { queued: "Queued", processing: "Processing", completed: "Completed", partial: "Partial", failed: "Failed" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}
