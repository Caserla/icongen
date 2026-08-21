"use client";

import type { AccountSummary } from "@icongen/shared";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/i18n/locale-provider";

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

  if (error && !account) return <p role="alert" className="rounded-xl bg-[#fff1ed] p-4 text-danger">{error}</p>;
  if (!account) return <p className="text-sm text-muted">{t("loadingAccount")}</p>;
  return <div className="account-copy-scale"><header><p className="text-xs font-black uppercase tracking-[.14em] text-brand-strong">{t("personal")}</p><h1 className="display-serif mt-2 text-4xl font-medium tracking-[-.045em] sm:text-5xl">{t("yourAccount")}</h1><p className="mt-2 text-sm text-muted">{t("accountCopy")}</p></header>
    <section className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Stat tone="bg-brand text-white" label={t("creditBalance")} value={String(account.creditBalance)} meta={t("oneCreditRule")} action={t("topUp")}/></section>
    <section className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><form onSubmit={save} className="rounded-[24px] border border-border bg-[#f8f6ff] p-7 shadow-[0_18px_45px_rgba(70,48,150,.10)]"><h2 className="text-xl font-black tracking-[-.025em]">{t("profile")}</h2><p className="mt-1 text-xs text-muted">{t("profileCopy")}</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label={t("displayName")} value={displayName} onChange={setDisplayName}/><Field label={t("email")} value={account.email} disabled/></div>{error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}{message ? <p role="status" className="mt-4 text-sm text-success">{message}</p> : null}<button disabled={busy} className="focus-ring mt-6 min-h-12 rounded-xl bg-brand px-6 font-black text-white shadow-[0_4px_0_#4930c9] transition hover:bg-brand-strong disabled:opacity-60">{busy ? t("saving") : t("save")}</button></form><article className="rounded-[24px] border border-border bg-surface p-7 shadow-[0_12px_35px_rgba(30,22,48,.06)]"><h2 className="text-lg font-black">{t("security")}</h2><p className="mt-1 text-xs text-muted">{t("securityCopy")}</p><Security title={account.emailVerified ? t("verified") : t("verificationPending")} sub={account.email}/></article></section>
    </div>;
}

function Stat({ tone, label, value, meta, action }: { tone: string; label: string; value: string; meta: string; action: string }) { return <article className={`flex min-h-40 items-end justify-between gap-5 rounded-[20px] border border-border p-6 ${tone}`}><div><p className="text-sm font-black uppercase tracking-[.1em] opacity-70">{label}</p><strong className="mt-5 block text-5xl tracking-[-.06em]">{value}</strong><p className="mt-2 text-sm opacity-70">{meta}</p></div><Link href="/pricing" className="focus-ring inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-white px-6 text-base font-black text-brand transition hover:-translate-y-0.5">{action}</Link></article>; }
function Field({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange?: (value: string) => void }) { return <label className="text-sm font-black">{label}<input value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className="focus-ring mt-2 min-h-13 w-full rounded-[14px] border border-[#d7d0ea] bg-surface px-4 text-base font-normal shadow-[0_2px_8px_rgba(30,22,48,.04)] disabled:bg-[#efecf5] disabled:text-muted"/></label>; }
function Security({ title, sub }: { title: string; sub: string }) { return <div className="mt-5 flex gap-3 border-t border-border pt-5"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eee9ff] text-lg font-black text-brand">✓</span><span><b className="block text-sm">{title}</b><small className="mt-1 block text-sm text-muted">{sub}</small></span></div>; }
