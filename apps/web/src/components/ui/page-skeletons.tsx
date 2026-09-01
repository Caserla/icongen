function SkeletonBlock({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-block block ${className}`} />;
}

export function CreatePageSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  const formSkeleton = (
    <>
      <SkeletonBlock className="h-7 w-32 rounded-lg" />
      <SkeletonBlock className="mt-3 h-4 w-80 max-w-full rounded-md" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-2xl border border-border p-4">
            <SkeletonBlock className="h-5 w-28 rounded-md" />
            <SkeletonBlock className="mt-3 h-4 w-full rounded-md" />
            <SkeletonBlock className="mt-2 h-4 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
      <div className="mt-8 border-t border-border pt-7">
        <SkeletonBlock className="h-7 w-36 rounded-lg" />
        <SkeletonBlock className="mt-4 h-24 w-full rounded-2xl" />
      </div>
      <div className="mt-8 border-t border-border pt-7">
        <SkeletonBlock className="h-7 w-32 rounded-lg" />
        <div className="mt-4 flex flex-wrap gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonBlock key={index} className="h-10 w-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="mt-8 flex justify-end">
        <SkeletonBlock className="h-12 w-32 rounded-xl" />
      </div>
    </>
  );
  return (
    <div role="status" aria-label="正在加载图标生成页面" aria-busy="true">
      {includeHeader ? (
        <div>
          <SkeletonBlock className="h-12 w-64 max-w-[75%] rounded-xl" />
          <SkeletonBlock className="mt-4 h-5 w-[34rem] max-w-full rounded-lg" />
        </div>
      ) : null}
      {includeHeader ? (
        <section className="mt-8 rounded-[24px] border border-border bg-surface p-5 sm:p-7">{formSkeleton}</section>
      ) : formSkeleton}
      <span className="sr-only">正在加载…</span>
    </div>
  );
}

export function IconsPageSkeleton() {
  return (
    <div role="status" aria-label="正在加载我的图标" aria-busy="true">
      <SkeletonBlock className="h-12 w-48 max-w-[70%] rounded-xl" />
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
          <div key={item} className="rounded-[20px] border border-border bg-white p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-5 w-48 max-w-[70%] rounded-md" />
                <SkeletonBlock className="mt-3 h-4 w-56 max-w-[85%] rounded-md" />
              </div>
              <SkeletonBlock className="h-7 w-20 rounded-full" />
            </div>
            <div className="mt-4 grid max-w-[420px] grid-cols-3 gap-3">
              {[0, 1, 2].map((preview) => (
                <SkeletonBlock key={preview} className="aspect-square rounded-2xl" />
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
      <div className="flex items-start justify-between gap-4">
        <SkeletonBlock className="h-10 w-40 rounded-xl" />
        <SkeletonBlock className="h-7 w-20 rounded-full" />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-5 w-36 rounded-md" />
          <SkeletonBlock className="h-4 w-28 rounded-md" />
        </div>
        <SkeletonBlock className="mt-4 h-3 w-full rounded-full" />
        <div className="mt-3 flex items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-44 rounded-md" />
          <SkeletonBlock className="h-4 w-20 rounded-md" />
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-surface p-5">
        <SkeletonBlock className="h-7 w-64 max-w-[75%] rounded-lg" />
        <SkeletonBlock className="mt-2 h-4 w-96 max-w-full rounded-md" />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-2xl border border-border p-3">
              <SkeletonBlock className="aspect-square w-full rounded-xl" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <SkeletonBlock className="h-5 w-16 rounded-md" />
                <SkeletonBlock className="h-6 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 shadow-lg">
        <SkeletonBlock className="h-4 w-64 max-w-full rounded-md" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-11 w-24 rounded-xl" />
          <SkeletonBlock className="h-11 w-32 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">正在加载生成结果…</span>
    </div>
  );
}
