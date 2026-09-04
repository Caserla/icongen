"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Brand } from "@/components/ui/brand";

export function AdminHeader() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between px-5">
        <div className="flex items-center gap-5">
          <Brand />
          <span className="rounded-full bg-foreground px-3 py-1 text-xs font-black text-white">
            {zh ? "管理后台" : "Admin console"}
          </span>
        </div>
        <Link href="/icons" className="focus-ring text-sm font-black text-muted hover:text-foreground">
          {zh ? "返回产品" : "Back to product"}
        </Link>
      </div>
    </header>
  );
}
