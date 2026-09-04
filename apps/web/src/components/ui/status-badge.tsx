"use client";
import type { GenerationJobStatusV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";

export function StatusBadge({ status }: { status: GenerationJobStatusV2 }) {
  const { locale } = useLocale();
  const labels: Record<GenerationJobStatusV2, string> = locale === "zh" ? { queued: "排队中", processing: "生成中", completed: "已完成", partial: "部分完成", failed: "失败" } : { queued: "Queued", processing: "Processing", completed: "Completed", partial: "Partial", failed: "Failed" };
  return <span className={`status-badge status-badge--${status} draft-label inline-flex whitespace-nowrap px-2.5 py-1`}>{labels[status]}</span>;
}
