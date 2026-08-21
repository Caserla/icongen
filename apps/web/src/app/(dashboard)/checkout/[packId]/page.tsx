"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";

const packs = {
  starter: { name: "Starter", credits: 30, price: "$2.99" },
  maker: { name: "Maker", credits: 75, price: "$6.49" },
  studio: { name: "Studio", credits: 180, price: "$12.99" },
} as const;

export default function CheckoutPage() {
  const { locale } = useLocale();
  const { packId } = useParams<{ packId: string }>();
  const pack = packs[packId as keyof typeof packs];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!pack) return <div><h1 className="display-serif text-4xl">{locale === "zh" ? "点数包不存在" : "Credit pack not found"}</h1><Link href="/pricing" className="mt-5 inline-block font-black underline">← {locale === "zh" ? "返回价格页" : "Back to pricing"}</Link></div>;

  async function checkout() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) { setMessage(locale === "zh" ? "支付服务尚未连接，请配置 Stripe 后重试。" : "Payments are not connected yet. Configure Stripe and try again."); return; }
    const data = await response.json();
    if (data.url) window.location.assign(data.url);
  }

  return <div className="mx-auto max-w-2xl"><p className="text-xs font-black uppercase tracking-[.16em] text-brand">{locale === "zh" ? "确认充值" : "Confirm purchase"}</p><h1 className="display-serif mt-3 text-4xl sm:text-5xl">{pack.name}</h1><section className="mt-8 rounded-[20px] border border-border bg-background p-6"><div className="flex items-end justify-between gap-4"><div><b className="text-2xl">{pack.credits} {locale === "zh" ? "点" : "credits"}</b><p className="mt-2 text-sm text-muted">{locale === "zh" ? "1 点可生成 1 个主体的 3 个方案" : "1 credit generates 3 variants for 1 subject"}</p></div><strong className="text-3xl">{pack.price}</strong></div></section>{message ? <p role="alert" className="mt-5 rounded-xl bg-[#fff1ed] p-4 text-sm text-danger">{message}</p> : null}<button onClick={checkout} disabled={busy} className="focus-ring mt-6 min-h-13 w-full rounded-xl bg-brand px-5 font-black text-white disabled:opacity-60">{busy ? (locale === "zh" ? "正在跳转…" : "Redirecting…") : (locale === "zh" ? "继续前往安全支付" : "Continue to secure checkout")}</button><Link href="/pricing" className="mt-5 block text-center text-sm font-black underline">{locale === "zh" ? "返回选择其他点数包" : "Choose another pack"}</Link></div>;
}
