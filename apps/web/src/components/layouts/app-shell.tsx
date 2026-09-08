"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { ThemeSwitch } from "@/components/i18n/theme-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/components/layouts/user-menu";
import type { Viewer } from "@/lib/auth/viewer";

export function AppShell({
  children,
  viewer,
}: {
  children: ReactNode;
  viewer: Viewer | null;
}) {
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const createSelected = pathname === "/create";
  const iconsSelected = pathname === "/icons" || pathname.startsWith("/icons/");
  const navClass = (selected: boolean) =>
    `studio-nav-link focus-ring whitespace-nowrap ${selected ? "is-selected" : ""}`;

  return (
    <div className="studio-shell min-h-screen">
      <header className="studio-header workspace-header relative z-30 mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8">
        <Brand />
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Workspace navigation"
          >
            <Link
              href="/create"
              aria-current={createSelected ? "page" : undefined}
              className={navClass(createSelected)}
            >
              {t("workspace")}
            </Link>
            <Link
              href="/icons"
              aria-current={iconsSelected ? "page" : undefined}
              className={navClass(iconsSelected)}
            >
              {t("myIcons")}
            </Link>
            <Link href="/library" aria-current={pathname.startsWith('/library') ? 'page' : undefined} className={navClass(pathname.startsWith('/library'))}>
              {locale === 'zh' ? '素材库' : 'Library'}
            </Link>
          </nav>
          <ThemeSwitch />
          <LanguageSwitch />
          {viewer ? (
            <UserMenu viewer={viewer} />
          ) : (
            <Link
              href="/account"
              className="studio-button studio-button--primary focus-ring hidden px-4 py-3 text-sm font-extrabold sm:block"
            >
              {t("account")}
            </Link>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 sm:pt-12">
        <main className="studio-main page-paper-enter relative min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
