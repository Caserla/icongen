"use client";

import { useEffect, useState } from "react";
import type { GenerationJobV2 } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { IconResultPageSkeleton } from "@/components/ui/page-skeletons";
import { JobDetails } from "./job-details";

export function JobDetailsLoader({ jobId }: { jobId: string }) {
  const { locale } = useLocale();
  const [job, setJob] = useState<GenerationJobV2 | null>(null);
  const [failed, setFailed] = useState(false);
  const [cachedPreviews] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const value = JSON.parse(sessionStorage.getItem(`icongen:job-previews:${jobId}`) ?? "[]") as unknown;
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/generation/jobs/${jobId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load icon details");
        return (await response.json()) as GenerationJobV2;
      })
      .then(setJob)
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          setFailed(true);
      });
    return () => controller.abort();
  }, [jobId]);

  if (job) return <JobDetails initialJob={job} />;

  if (!failed) return <IconResultPageSkeleton previewUrls={cachedPreviews} />;

  return (
    <main className="icon-results-studio studio-page-enter mx-auto w-full max-w-[1600px] px-5 pb-20 pt-28 sm:px-8">
      <div className="mb-6 flex items-center gap-5">
        <span className="text-sm font-semibold text-muted">
          {locale === "zh" ? "图标详情加载失败" : "Could not load icon details"}
        </span>
      </div>
    </main>
  );
}
