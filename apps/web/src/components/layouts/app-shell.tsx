"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useLocale } from "@/components/i18n/locale-provider";
import { UserMenu } from "@/components/layouts/user-menu";
import type { Viewer } from "@/lib/auth/viewer";

export function AppShell({children,viewer}:{children:ReactNode;viewer:Viewer|null}) {
  const {t}=useLocale();
  const pathname = usePathname();
  const createSelected = pathname === "/create";
  const iconsSelected = pathname === "/icons" || pathname.startsWith("/icons/");
  const navClass = (selected: boolean) => `focus-ring whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition ${selected ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-surface-muted hover:text-foreground"}`;

  return <div className="soft-spot min-h-screen p-3 sm:p-5">
    <header className="surface-elevated relative z-30 mx-auto mb-5 flex min-h-17 max-w-7xl items-center justify-between gap-3 rounded-[20px] border border-border bg-surface/90 px-4 backdrop-blur-xl sm:px-5">
      <Brand/>
      <div className="ml-auto flex shrink-0 items-center gap-3"><nav className="hidden items-center gap-1 md:flex" aria-label="Workspace navigation"><Link href="/create" aria-current={createSelected ? "page" : undefined} className={navClass(createSelected)}>{t("workspace")}</Link><Link href="/icons" aria-current={iconsSelected ? "page" : undefined} className={navClass(iconsSelected)}>{t("myIcons")}</Link></nav><LanguageSwitch/>{viewer?<UserMenu viewer={viewer}/>:<Link href="/account" className="focus-ring hidden rounded-xl bg-foreground px-4 py-3 text-sm font-extrabold text-white sm:block">{t("account")}</Link>}</div>
    </header>
    <div className="mx-auto max-w-7xl">
      <main className="panel-shadow relative min-w-0 overflow-hidden rounded-[30px] border border-border bg-surface p-5 sm:p-8 lg:p-12">
        {children}
      </main>
    </div>
  </div>;
}
