"use client";

import type { AccountSummary } from "@icongen/shared";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { SkeletonBlock } from "@/components/ui/page-skeletons";

export default function AccountPage() {
  const { t } = useLocale();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/account").then(async (response) => {
    if (!response.ok) throw new Error();
    return (await response.json()) as AccountSummary;
  }).then((data) => { setAccount(data); setDisplayName(data.displayName ?? ""); })
    .catch(() => setError(t("loadAccountFailed"))); }, [t]);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) return setError(t("saveProfileFailed"));
    const data = await response.json() as { displayName: string };
    setDisplayName(data.displayName); setAccount((current) => current ? { ...current, displayName: data.displayName } : current); window.dispatchEvent(new CustomEvent("icongen-profile-updated", { detail: { displayName: data.displayName } })); setMessage(t("saved"));
  }

  if (error && !account) return <p role="alert" className="studio-notice studio-notice--error p-4">{error}</p>;
  if (!account) return <div className="account-copy-scale" role="status" aria-label={t("loadingAccount")} aria-busy="true"><SkeletonBlock className="h-10 w-52 rounded-xl"/><SkeletonBlock className="mt-3 h-4 w-80 max-w-full rounded-lg"/><section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><SkeletonBlock className="h-40 w-full rounded-2xl"/></section><section className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><SkeletonBlock className="h-72 w-full rounded-2xl"/><SkeletonBlock className="h-72 w-full rounded-2xl"/></section></div>;
  return <div className="account-copy-scale"><header><p className="text-xs font-black uppercase tracking-[.14em] text-brand-strong">{t("personal")}</p><h1 className="display-serif mt-2 text-4xl font-medium tracking-[-.045em] sm:text-5xl">{t("yourAccount")}</h1><p className="mt-2 text-sm text-muted">{t("accountCopy")}</p></header>
    <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Stat tone="bg-brand text-white" label={t("creditBalance")} value={String(account.creditBalance)} meta={t("oneCreditRule")} action={t("topUp")} history={t("creditHistory")}/></section>
    <section className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><form onSubmit={save} className="studio-panel p-7"><h2 className="text-xl font-black tracking-[-.025em]">{t("profile")}</h2><p className="mt-1 text-xs text-muted">{t("profileCopy")}</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label={t("displayName")} value={displayName} maxLength={18} onChange={setDisplayName}/><Field label={t("email")} value={account.email} disabled/></div>{error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}{message ? <p role="status" className="mt-4 text-sm text-success">{message}</p> : null}<button disabled={busy} className="studio-button studio-button--primary focus-ring mt-6 min-h-12 px-6 font-black disabled:opacity-60">{busy ? t("saving") : t("save")}</button></form><article className="studio-panel p-7"><h2 className="text-lg font-black">{t("security")}</h2><p className="mt-1 text-xs text-muted">{t("securityCopy")}</p><Security title={account.emailVerified ? t("verified") : t("verificationPending")} sub={account.email}/></article></section>
    </div>;
}

function Stat({ tone, label, value, meta, action, history }: { tone: string; label: string; value: string; meta: string; action: string; history: string }) { return <article className={`flex min-h-40 flex-wrap items-end justify-between gap-5 rounded-[6px] border border-border p-6 ${tone}`}><div><p className="text-sm font-black uppercase tracking-[.1em] opacity-70">{label}</p><strong className="mt-5 block text-5xl tracking-[-.06em]">{value}</strong><p className="mt-2 text-sm opacity-70">{meta}</p></div><div className="flex shrink-0 items-center gap-4"><Link href="/account/credits" className="focus-ring text-sm font-black text-white underline decoration-2 underline-offset-4">{history}</Link><Link href="/pricing" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-[4px] bg-white px-6 text-base font-black text-brand transition hover:-translate-y-0.5">{action}</Link></div></article>; }
function Field({ label, value, disabled, maxLength, onChange }: { label: string; value: string; disabled?: boolean; maxLength?: number; onChange?: (value: string) => void }) { return <label className="text-sm font-black">{label}<input value={value} disabled={disabled} maxLength={maxLength} onChange={(event) => onChange?.(event.target.value)} className="draft-control focus-ring mt-2 min-h-13 w-full px-4 text-base font-normal disabled:bg-surface-muted disabled:text-muted"/></label>; }
function Security({ title, sub }: { title: string; sub: string }) { return <div className="mt-5 flex gap-3 border-t border-border pt-5"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#252525] text-lg font-black text-[#75d69c]">✓</span><span><b className="block text-sm">{title}</b><small className="mt-1 block text-sm text-muted">{sub}</small></span></div>; }
