"use client";

import type { AccountSummary } from "@icongen/shared";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { PageState } from "@/components/ui/page-state";
import { Toast } from "@/components/ui/toast";

export default function AccountPage() {
  const { t } = useLocale();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as AccountSummary;
      })
      .then((data) => {
        setAccount(data);
        setDisplayName(data.displayName ?? "");
      })
      .catch(() => setError(t("loadAccountFailed")));
  }, [t]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) return setError(t("saveProfileFailed"));
    const data = (await response.json()) as { displayName: string };
    setDisplayName(data.displayName);
    setAccount((current) =>
      current ? { ...current, displayName: data.displayName } : current,
    );
    window.dispatchEvent(
      new CustomEvent("icongen-profile-updated", {
        detail: { displayName: data.displayName },
      }),
    );
    setMessage(t("saved"));
  }

  if (error && !account)
    return (
      <>
        <PageState />
        <Toast message={error} variant="error" />
      </>
    );
  if (!account)
    return (
      <PageState />
    );
  return (
    <div className="account-copy-scale">
      <header>
        <p className="text-xs font-black uppercase tracking-[.14em] text-brand-strong">
          {t("personal")}
        </p>
        <h1 className="display-serif mt-2 text-4xl font-medium tracking-[-.045em] sm:text-5xl">
          {t("yourAccount")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("accountCopy")}</p>
      </header>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <form onSubmit={save} className="studio-panel p-6 sm:p-7">
          <h2 className="text-xl font-black tracking-[-.025em]">
            {t("profile")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("profileCopy")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label={t("displayName")}
              value={displayName}
              maxLength={18}
              onChange={setDisplayName}
            />
            <Field label={t("email")} value={account.email} disabled />
          </div>
          {error ? (
            <Toast message={error} variant="error" />
          ) : null}
          {message ? (
            <p
              role="status"
              className="studio-notice studio-notice--success mt-4 p-3 text-sm"
            >
              {message}
            </p>
          ) : null}
          <button
            disabled={busy}
            className="studio-button studio-button--primary focus-ring mt-5 min-h-12 px-6 font-black disabled:opacity-60"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </form>
        <article className="studio-panel p-6 sm:p-7">
          <h2 className="text-xl font-black tracking-[-.025em]">
            {t("security")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("securityCopy")}</p>
          <Security
            title={
              account.emailVerified ? t("verified") : t("verificationPending")
            }
            sub={account.email}
          />
        </article>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  maxLength?: number;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="text-sm font-black">
      {label}
      <input
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange?.(event.target.value)}
        className="focus-ring mt-2 min-h-13 w-full rounded-xl border border-border bg-surface-muted px-4 text-base font-normal text-foreground disabled:cursor-not-allowed disabled:text-muted"
      />
    </label>
  );
}
function Security({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-5 flex gap-3 border-t border-border pt-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#252525] text-lg font-black text-[#75d69c]">
        ✓
      </span>
      <span>
        <b className="block text-sm">{title}</b>
        <small className="mt-1 block text-sm text-muted">{sub}</small>
      </span>
    </div>
  );
}
