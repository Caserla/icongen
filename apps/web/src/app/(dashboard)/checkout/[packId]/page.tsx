"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { findPricingPack } from "@/lib/pricing-packs";

export default function CheckoutPage() {
  const { locale } = useLocale();
  const { packId } = useParams<{ packId: string }>();
  const pack = findPricingPack(packId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!pack) return <div><h1 className="display-serif text-4xl">{locale === "zh" ? "找不到该点数包" : "Credit pack not found"}</h1><Link href="/pricing" className="mt-5 inline-block font-black underline">← {locale === "zh" ? "返回点数包" : "Back to credit packs"}</Link></div>;

  async function checkout() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) { setMessage(locale === "zh" ? "支付功能暂不可用，请稍后再试。" : "Payments are temporarily unavailable. Please try again later."); return; }
    const data = await response.json();
    if (data.url) window.location.assign(data.url);
  }

  return <div className="mx-auto max-w-2xl"><p className="text-xs font-black uppercase tracking-[.16em] text-brand">{locale === "zh" ? "确认点数包" : "Review your credit pack"}</p><h1 className="display-serif mt-3 text-4xl sm:text-5xl">{pack.name[locale === "zh" ? "zh" : "en"]}</h1><section className="mt-8 rounded-[6px] border border-border bg-background p-6"><div className="flex items-end justify-between gap-4"><div><b className="text-2xl">{pack.credits} {locale === "zh" ? "点" : "credits"}</b><p className="mt-2 text-sm text-muted">{locale === "zh" ? "1 点可为 1 个图标主体生成 3 个方案；失败方案重新生成不扣点，每个方案包含 3 次细节调整。" : "1 credit creates 3 options for one subject. Failed options can be regenerated free, and every option includes 3 detail edits."}</p></div><strong className="text-3xl">{pack.price}</strong></div></section>{message ? <p role="alert" className="mt-5 rounded-[4px] bg-[#fff1ed] p-4 text-sm text-danger">{message}</p> : null}<button onClick={checkout} disabled={busy} className="focus-ring mt-6 min-h-13 w-full rounded-[4px] bg-brand px-5 font-black text-white disabled:opacity-60">{busy ? (locale === "zh" ? "正在跳转…" : "Redirecting…") : (locale === "zh" ? "前往支付" : "Continue to payment")}</button><Link href="/pricing" className="mt-5 block text-center text-sm font-black underline">{locale === "zh" ? "返回点数包" : "Back to credit packs"}</Link></div>;
}
