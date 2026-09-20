"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Toast } from "@/components/ui/toast";

let lastAutomaticRecovery = 0;

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { locale } = useLocale();
  useEffect(() => {
    const now = Date.now();
    if (now - lastAutomaticRecovery < 3000) return;
    lastAutomaticRecovery = now;
    const timer = window.setTimeout(reset, 250);
    return () => window.clearTimeout(timer);
  }, [reset]);

  return <Toast message={locale === "zh" ? "页面暂时无法显示，正在恢复…" : "The page hit an error and is recovering…"} variant="error" />;
}
