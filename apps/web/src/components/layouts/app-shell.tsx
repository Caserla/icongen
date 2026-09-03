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
  const navClass = (selected: boolean) => `nav-draft-link motion-filter focus-ring whitespace-nowrap px-3 py-2 text-sm font-bold ${selected ? "bg-brand text-white" : "text-muted hover:bg-surface-muted hover:text-foreground"}`;

  return <div className="soft-spot min-h-screen px-3 py-4 sm:px-6 sm:py-5">
    <header className="workspace-header surface-elevated relative z-30 mx-auto mb-6 flex min-h-16 max-w-7xl items-center justify-between gap-3 rounded-[5px] border border-[#77736b] bg-[#fffaf0] px-4 sm:px-6">
      <Brand/>
      <div className="ml-auto flex shrink-0 items-center gap-3"><nav className="hidden items-center gap-1 md:flex" aria-label="Workspace navigation"><Link href="/create" aria-current={createSelected ? "page" : undefined} className={navClass(createSelected)}>{t("workspace")}</Link><Link href="/icons" aria-current={iconsSelected ? "page" : undefined} className={navClass(iconsSelected)}>{t("myIcons")}</Link></nav><LanguageSwitch/>{viewer?<UserMenu viewer={viewer}/>:<Link href="/account" className="focus-ring hidden rounded-[4px] bg-foreground px-4 py-3 text-sm font-extrabold text-white sm:block">{t("account")}</Link>}</div>
    </header>
    <div className="mx-auto max-w-7xl">
      <div className="workspace-meta draft-label mb-2 flex items-center justify-between px-1 text-[#d9e2f0]/65"><span>ICON WORKSPACE / BAMBOO</span><span>DESIGN SYSTEM 02</span></div>
      <main className="paper-panel page-paper-enter panel-shadow relative min-w-0 overflow-hidden rounded-[7px] border border-[#6e6b65] p-5 sm:p-8 lg:p-12">
        {children}
      </main>
    </div>
  </div>;
}
