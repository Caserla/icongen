"use client";

import { useLocale } from "@/components/i18n/locale-provider";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`skeleton-block block ${className}`} />
  );
}

export function CreatePageSkeleton({
  includeHeader = true,
}: {
  includeHeader?: boolean;
}) {
  const { locale } = useLocale();
  const loadingLabel =
    locale === "zh" ? "正在加载图标生成页面" : "Loading icon generator";
  const loadingText = locale === "zh" ? "正在加载…" : "Loading…";
  return (
    <div
      className="create-studio"
      role="status"
      aria-label={loadingLabel}
      aria-busy="true"
    >
      {includeHeader ? (
        <SkeletonBlock className="mb-4 h-4 w-40 rounded-lg" />
      ) : null}
      <section className="generation-studio-form grid min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative overflow-hidden rounded-[24px] border border-border bg-[#101010] p-4">
          <SkeletonBlock className="h-full min-h-[580px] w-full rounded-[18px]" />
        </div>
        <div className="grid min-h-0 grid-rows-[1fr_auto_auto] gap-3 rounded-[18px] border border-border bg-surface p-4">
          <div>
            <SkeletonBlock className="h-5 w-28 rounded-lg" />
            {[0, 1, 2, 3].map((item) => (
              <SkeletonBlock
                key={item}
                className="mt-3 h-11 w-full rounded-xl"
              />
            ))}
          </div>
          <SkeletonBlock className="h-24 w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
        </div>
      </section>
      <span className="sr-only">{loadingText}</span>
    </div>
  );
}

export function IconsPageSkeleton() {
  const { locale } = useLocale();
  return (
    <div
      className="icons-studio icons-page-skeleton"
      role="status"
      aria-label={locale === "zh" ? "正在加载我的图标" : "Loading my icons"}
      aria-busy="true"
    >
      <div className="icons-studio__filters">
        {[2, 5, 4].map((count, sectionIndex) => (
          <section key={sectionIndex} className="icons-filter-group">
            <SkeletonBlock className="mb-3 h-3 w-20 rounded" />
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: count }, (_, index) => (
                <SkeletonBlock
                  key={index}
                  className="h-[34px] w-20 rounded-[10px]"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="icons-jobs-grid mt-6">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="icon-library-card">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-3 w-28 rounded" />
                <SkeletonBlock className="mt-3 h-4 w-56 max-w-[85%] rounded-md" />
              </div>
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((preview) => (
                <SkeletonBlock
                  key={preview}
                  className="aspect-square rounded-xl"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">
        {locale === "zh" ? "正在加载…" : "Loading…"}
      </span>
    </div>
  );
}

export function IconResultPageSkeleton({
  previewUrls = [],
}: {
  previewUrls?: string[];
}) {
  const { locale } = useLocale();
  return (
    <div
      role="status"
      aria-label={
        locale === "zh" ? "正在加载生成结果" : "Loading generation results"
      }
      aria-busy="true"
      className="icon-results-studio icon-results-skeleton space-y-8"
    >
      <div>
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
        <SkeletonBlock className="mt-3 h-9 w-40 rounded-xl" />
      </div>

      <section className="studio-panel p-5">
        <SkeletonBlock className="h-7 w-52 max-w-[75%] rounded-lg" />
        <SkeletonBlock className="mt-2 h-4 w-80 max-w-full rounded-lg" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="icon-results-skeleton__card p-3">
              {previewUrls[item] ? (
                // Cached list-page assets make the detail transition feel immediate.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[item]}
                  alt=""
                  className="aspect-square w-full rounded-xl object-contain"
                />
              ) : (
                <SkeletonBlock className="aspect-square w-full rounded-xl" />
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <SkeletonBlock className="h-5 w-16 rounded-lg" />
                <SkeletonBlock className="h-6 w-14 rounded-lg" />
              </div>
              <SkeletonBlock className="mt-3 h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </section>

      <div className="icon-results-skeleton__actions flex flex-wrap items-center justify-between gap-4 p-4">
        <SkeletonBlock className="h-4 w-64 max-w-full rounded-lg" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-11 w-24 rounded-xl" />
          <SkeletonBlock className="h-11 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
