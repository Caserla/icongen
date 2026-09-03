export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-block block ${className}`} />;
}

export function CreatePageSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  const formSkeleton = (
    <>
      <SkeletonBlock className="h-7 w-32 rounded-lg" />
      <SkeletonBlock className="mt-3 h-4 w-80 max-w-full rounded-md" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-[6px] border border-border p-4">
            <SkeletonBlock className="h-5 w-28 rounded-md" />
            <SkeletonBlock className="mt-3 h-4 w-full rounded-md" />
            <SkeletonBlock className="mt-2 h-4 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
      <div className="mt-8 border-t border-border pt-7">
        <SkeletonBlock className="h-7 w-36 rounded-lg" />
        <SkeletonBlock className="mt-4 h-24 w-full rounded-[6px]" />
      </div>
      <div className="mt-8 border-t border-border pt-7">
        <SkeletonBlock className="h-7 w-32 rounded-lg" />
        <div className="mt-4 flex flex-wrap gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonBlock key={index} className="h-10 w-20 rounded-[4px]" />
          ))}
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <SkeletonBlock className="h-12 w-32 rounded-[4px]" />
      </div>
    </>
  );
  return (
    <div role="status" aria-label="正在加载图标生成页面" aria-busy="true">
      {includeHeader ? (
        <div>
          <SkeletonBlock className="h-12 w-64 max-w-[75%] rounded-[4px]" />
          <SkeletonBlock className="mt-4 h-5 w-[34rem] max-w-full rounded-lg" />
        </div>
      ) : null}
      {includeHeader ? (
        <section className="mt-8 rounded-[7px] border border-border bg-surface p-5 sm:p-7">{formSkeleton}</section>
      ) : formSkeleton}
      <span className="sr-only">正在加载…</span>
    </div>
  );
}

export function IconsPageSkeleton() {
  return (
    <div role="status" aria-label="正在加载我的图标" aria-busy="true">
      <SkeletonBlock className="h-12 w-48 max-w-[70%] rounded-[4px]" />
      {[2, 7, 5].map((count, sectionIndex) => (
        <section key={sectionIndex} className="mt-5 border-t border-border pt-5 first:mt-7 first:border-0 first:pt-0">
          <SkeletonBlock className="mb-3 h-5 w-20 rounded-md" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: count }, (_, index) => (
              <SkeletonBlock key={index} className="h-10 w-24 rounded-full" />
            ))}
          </div>
        </section>
      ))}
      <div className="mt-8 grid gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-[6px] border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-5 w-48 max-w-[70%] rounded-md" />
                <SkeletonBlock className="mt-3 h-4 w-56 max-w-[85%] rounded-md" />
              </div>
              <SkeletonBlock className="h-7 w-20 rounded-full" />
            </div>
            <div className="mt-4 grid max-w-[420px] grid-cols-3 gap-3">
              {[0, 1, 2].map((preview) => (
                <SkeletonBlock key={preview} className="aspect-square rounded-[6px]" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">正在加载…</span>
    </div>
  );
}

export function IconResultPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="正在加载生成结果"
      aria-busy="true"
      className="space-y-8"
    >
      <div>
        <SkeletonBlock className="h-10 w-32 rounded-[4px]" />
        <SkeletonBlock className="mt-3 h-9 w-40 rounded-[4px]" />
      </div>

      <section className="paper-panel rounded-[7px] border border-border p-5">
        <SkeletonBlock className="h-7 w-52 max-w-[75%] rounded-[3px]" />
        <SkeletonBlock className="mt-2 h-4 w-80 max-w-full rounded-[3px]" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-[6px] border border-border bg-[#fffaf0]/80 p-3">
              <SkeletonBlock className="aspect-square w-full rounded-[4px]" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <SkeletonBlock className="h-5 w-16 rounded-[3px]" />
                <SkeletonBlock className="h-6 w-14 rounded-[2px]" />
              </div>
              <SkeletonBlock className="mt-3 h-10 w-full rounded-[4px]" />
            </div>
          ))}
        </div>
      </section>

      <div className="paper-panel flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-border p-4 shadow-[5px_5px_0_rgba(11,23,50,.16)]">
        <SkeletonBlock className="h-4 w-64 max-w-full rounded-[3px]" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-11 w-24 rounded-[4px]" />
          <SkeletonBlock className="h-11 w-32 rounded-[4px]" />
        </div>
      </div>
      <span className="sr-only">正在加载生成结果…</span>
    </div>
  );
}
