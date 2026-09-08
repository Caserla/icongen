"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Brand } from "@/components/ui/brand";
import { ThemeSwitch } from "@/components/i18n/theme-switch";

export function AdminHeader() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  return (
    <header className="studio-header sticky top-3 z-30 mx-3 rounded-[18px] border border-white/10 bg-[#151515]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 max-w-[1500px] items-center justify-between px-5">
        <div className="flex items-center gap-5">
          <Brand />
          <span className="rounded-lg bg-[#252525] px-3 py-1 text-xs font-black text-muted">
            {zh ? "管理后台" : "Admin console"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitch />
          <Link href="/icons" className="focus-ring text-sm font-black text-muted hover:text-foreground">{zh ? "返回产品" : "Back to product"}</Link>
        </div>
      </div>
    </header>
  );
}
