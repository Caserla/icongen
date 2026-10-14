"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";

export function MarketingFooter() {
  const { locale } = useLocale();
  const zh = locale === "zh";

  return (
    <footer className="border-t border-[#292929] bg-[#0a0909] px-5 py-6 text-sm text-[#8f8f8f]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <a href="mailto:support@esdesign.men" className="hover:text-[#f5f5f5]">support@esdesign.men</a>
        <nav className="flex gap-5" aria-label={zh ? "政策页面" : "Policies"}>
          <Link className="hover:text-[#f5f5f5]" href="/acceptable-use">{zh ? "使用规则" : "Acceptable Use"}</Link>
          <Link className="hover:text-[#f5f5f5]" href="/privacy">
            {zh ? "隐私协议" : "Privacy"}
          </Link>
          <Link className="hover:text-[#f5f5f5]" href="/terms">
            {zh ? "服务条款" : "Terms"}
          </Link>
          <Link className="hover:text-[#f5f5f5]" href="/security">
            {zh ? "安全政策" : "Security"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
