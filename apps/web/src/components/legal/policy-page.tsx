"use client";

import { useLocale, type Locale } from "@/components/i18n/locale-provider";

export type PolicySection = {
  title: Record<Locale, string>;
  paragraphs?: Record<Locale, string[]>;
  items?: Record<Locale, string[]>;
};

export function PolicyPage({
  eyebrow,
  title,
  summary,
  sections,
  version,
  lastUpdated,
}: {
  eyebrow: string;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  sections: PolicySection[];
  version?: Record<Locale, string>;
  lastUpdated?: Record<Locale, string>;
}) {
  const { locale } = useLocale();
  const zh = locale === "zh";

  return (
    <main className="studio-dark-page min-h-[calc(100vh-72px)] bg-[#0a0909] px-4 pb-20 pt-7 text-[#f5f5f5] sm:px-6 sm:pt-10">
      <article className="mx-auto max-w-4xl">
        <header className="rounded-[18px] border border-[#292929] bg-[#151515] px-6 py-8 sm:px-10 sm:py-11">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8f8f8f]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">
            {title[locale]}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#b8b8b8] sm:text-base">
            {summary[locale]}
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#787878]">
            <span>
              {version?.[locale] ??
                (zh ? "版本：预发布草案" : "Version: pre-release draft")}
            </span>
            <span>
              {lastUpdated?.[locale] ??
                (zh
                  ? "最后更新：2026 年 9 月 7 日"
                  : "Last updated: September 7, 2026")}
            </span>
          </div>
        </header>

        <div className="mt-4 space-y-4">
          {sections.map((section, index) => (
            <section
              key={section.title.en}
              className="rounded-[18px] border border-[#292929] bg-[#151515] px-6 py-7 sm:px-10 sm:py-9"
            >
              <div className="flex gap-4">
                <span className="mt-1 font-mono text-xs text-[#686868]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold tracking-[-.02em] sm:text-xl">
                    {section.title[locale]}
                  </h2>
                  {section.paragraphs?.[locale].map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-4 text-sm leading-7 text-[#b8b8b8]"
                    >
                      {paragraph}
                    </p>
                  ))}
                  {section.items ? (
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-[#b8b8b8]">
                      {section.items[locale].map((item) => (
                        <li key={item} className="flex gap-3">
                          <span aria-hidden="true" className="text-[#686868]">
                            —
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </section>
          ))}
        </div>

      </article>
    </main>
  );
}
