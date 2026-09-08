"use client";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useLocale } from "@/components/i18n/locale-provider";
export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const search = useSyncExternalStore(
    subscribeToLocation,
    getLocationSearch,
    () => "",
  );
  const params = new URLSearchParams(search);
  const nextPath = params.get("next") ?? "/create";
  const authUnavailable = params.get("reason") === "auth_unavailable";
  const invalidRecoveryLink = params.get("error") === "invalid_recovery_link";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    }).catch(() => null);
    setBusy(false);
    setMessage(response?.ok ? t("resetSent") : t("authRequestFailed"));
  }
  return (
    <AuthShell eyebrow={t("recovery")} title={t("resetPassword")}>
      <form onSubmit={submit}>
        {authUnavailable ? (
          <p
            role="status"
            className="studio-notice mt-5 p-3 text-sm text-muted"
          >
            {t("authUnavailable")}
          </p>
        ) : null}
        {invalidRecoveryLink ? (
          <p role="alert" className="studio-notice mt-5 p-3 text-sm text-muted">
            {t("resetInvalid")}
          </p>
        ) : null}
        <label className="mt-6 block text-sm font-black">
          {t("email")}
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            className="focus-ring mt-2 min-h-13 w-full rounded-xl border border-border bg-background px-4 font-normal"
          />
        </label>
        {message ? (
          <p role="status" className="studio-notice mt-4 p-3 text-sm">
            {message}
          </p>
        ) : null}
        <button
          disabled={busy || authUnavailable}
          className="studio-button studio-button--primary focus-ring mt-6 min-h-13 w-full px-5 font-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("sending") : t("sendReset")}
        </button>
        <Link
          className="mt-6 block text-center text-sm font-black underline"
          href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}${authUnavailable ? "&reason=auth_unavailable" : ""}`}
        >
          {t("backSignIn")}
        </Link>
      </form>
    </AuthShell>
  );
}
function subscribeToLocation() {
  return () => undefined;
}
function getLocationSearch() {
  return window.location.search;
}
