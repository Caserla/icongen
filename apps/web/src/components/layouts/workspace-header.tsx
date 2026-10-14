"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { ThemeSwitch } from "@/components/i18n/theme-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/components/layouts/user-menu";
import type { Viewer } from "@/lib/auth/viewer";
import { myIconsEnabled } from "@/lib/product-features";
import css from "./workspace-header.module.css";

export function WorkspaceHeader({ viewer = null }: { viewer?: Viewer | null }) {
  const { t, locale } = useLocale();
  const pathname = usePathname();
  const [fetchedViewer, setFetchedViewer] = useState<Viewer | null>(null);
  useEffect(() => {
    if (viewer) return;
    const controller = new AbortController();
    void fetch("/api/account", { signal: controller.signal, credentials: "same-origin" })
      .then(async response => {
        if (!response.ok) return;
        const account = await response.json() as { email?: string; displayName?: string | null; isAdmin?: boolean };
        if (!account.email) return;
        setFetchedViewer({ email: account.email, name: account.displayName?.trim() || account.email.split("@")[0], isAdmin: Boolean(account.isAdmin) });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [viewer]);
  const activeViewer = viewer ?? fetchedViewer;
  const selected = (href: string) => href === "/create" ? pathname === href : pathname.startsWith(href);
  const navClass = (href: string) => `studio-nav-link focus-ring whitespace-nowrap ${selected(href) ? "is-selected" : ""}`;
  return <header className={`${css.root} studio-header workspace-header relative z-30 mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-3`}>
    <div data-canvas-glass className="workspace-header__brand-pane flex min-h-16 shrink-0 items-center px-5 sm:px-6"><Brand /></div>
    <div data-canvas-glass className="workspace-header__controls-pane ml-auto flex min-h-16 shrink-0 items-center gap-3 px-3 sm:px-4">
      <nav className="hidden items-center gap-1 sm:flex" aria-label="Workspace navigation">
        <Link href="/create" aria-current={selected("/create") ? "page" : undefined} className={navClass("/create")}>{t("workspace")}</Link>
        {myIconsEnabled ? <Link href="/icons" aria-current={selected("/icons") ? "page" : undefined} className={navClass("/icons")}>{t("myIcons")}</Link> : null}
        <Link href="/library" aria-current={selected("/library") ? "page" : undefined} className={navClass("/library")}>{locale === "zh" ? "素材库" : "Library"}</Link>
      </nav>
      <ThemeSwitch />
      <LanguageSwitch />
      <UserMenu viewer={activeViewer} />
    </div>
  </header>;
}
