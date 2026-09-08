"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
export function VerifiedRedirect({ next }: { next: string }) {
  const { t } = useLocale();
  const [seconds, setSeconds] = useState(3);
  useEffect(() => {
    const countdown = window.setInterval(
      () => setSeconds((v) => Math.max(0, v - 1)),
      1000,
    );
    const redirect = window.setTimeout(
      () => window.location.replace(next),
      2200,
    );
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [next]);
  return (
    <div className="text-center">
      <span
        className="mx-auto grid size-20 place-items-center rounded-full bg-[#f5f5f5] text-4xl font-black text-[#171717]"
        aria-hidden="true"
      >
        ✓
      </span>
      <p className="mt-7 text-xs font-black uppercase tracking-[.14em] text-brand-strong">
        {t("emailConfirmed")}
      </p>
      <h1 className="display-serif mt-3 text-4xl tracking-[-.045em] sm:text-5xl">
        {t("verificationSuccess")}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted">
        {t("verificationSuccessCopy")}
      </p>
      <div
        className="studio-notice mt-7 p-4 text-sm text-muted"
        role="status"
        aria-live="polite"
      >
        {t("redirectingWorkspace")} {seconds > 0 ? `(${seconds}s)` : ""}
      </div>
      <Link
        href={next}
        className="studio-button studio-button--primary focus-ring mt-5 inline-grid min-h-12 place-items-center px-6 font-black"
      >
        {t("enterWorkspace")} →
      </Link>
    </div>
  );
}
