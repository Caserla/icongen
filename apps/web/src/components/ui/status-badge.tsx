"use client";
import type { GenerationJobStatusV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";

const styles: Record<GenerationJobStatusV2, string> = {
  queued: "border-[#8b8983] bg-[#ece5d8] text-slate-700",
  processing: "border-[#7182af] bg-[#e0e5f1] text-blue-800",
  completed: "border-[#75a28b] bg-[#e1ede5] text-emerald-800",
  partial: "border-[#bd9959] bg-[#f2e5c7] text-amber-900",
  failed: "border-[#bf776e] bg-[#f3dfda] text-red-800",
};

export function StatusBadge({ status }: { status: GenerationJobStatusV2 }) {
  const { locale } = useLocale();
  const labels: Record<GenerationJobStatusV2, string> = locale === "zh" ? { queued: "排队中", processing: "生成中", completed: "已完成", partial: "部分完成", failed: "失败" } : { queued: "Queued", processing: "Processing", completed: "Completed", partial: "Partial", failed: "Failed" };
  return <span className={`draft-label inline-flex whitespace-nowrap rounded-[3px] border px-2.5 py-1 ${styles[status]}`}>{labels[status]}</span>;
}
