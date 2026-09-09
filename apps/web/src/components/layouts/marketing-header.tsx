"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { ThemeSwitch } from "@/components/i18n/theme-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/components/layouts/user-menu";
import type { Viewer } from "@/lib/auth/viewer";
export function MarketingHeader({ viewer }: { viewer: Viewer | null }) {
  const { t, locale } = useLocale();
  const [activeViewer, setActiveViewer] = useState(viewer);
  useEffect(() => {
    if (viewer) return;
    const controller = new AbortController();
    void fetch("/api/account", {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) return;
        const account = (await response.json()) as {
          email?: string;
          displayName?: string | null;
          isAdmin?: boolean;
        };
        if (!account.email) return;
        setActiveViewer({
          email: account.email,
          name: account.displayName?.trim() || account.email.split("@")[0],
          isAdmin: Boolean(account.isAdmin),
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [viewer]);
  return (
    <header className="butter-marketing-header sticky top-0 z-20">
      <div className="butter-marketing-header__inner">
        <Brand />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {activeViewer ? (
            <nav
              className="hidden items-center md:flex"
              aria-label="Main navigation"
            >
              <Link href="/create" className="butter-nav-link focus-ring">
                {t("workspace")}
              </Link>
              <Link href="/icons" className="butter-nav-link focus-ring">
                {t("myIcons")}
              </Link>
              <Link href="/library" className="butter-nav-link focus-ring">
                {locale === 'zh' ? '素材库' : 'Library'}
              </Link>
            </nav>
          ) : null}
          <ThemeSwitch />
          <LanguageSwitch />
          {activeViewer ? (
            <UserMenu viewer={activeViewer} />
          ) : (
            <SignInDialog />
          )}
        </div>
      </div>
    </header>
  );
}
