"use client";
import { useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useLocale } from "@/components/i18n/locale-provider";
import { PasswordInput } from "@/components/ui/password-input";
export default function ResetPasswordPage() {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(
      form.get("passwordConfirmation") ?? "",
    );
    if (password !== passwordConfirmation) {
      setBusy(false);
      setMessage(t("passwordsDoNotMatch"));
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (!response) return setMessage(t("authRequestFailed"));
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setCompleted(true);
      setMessage(t("passwordUpdated"));
      return;
    }
    setMessage(
      data?.error?.code === "AUTH_SERVICE_UNAVAILABLE"
        ? t("authUnavailable")
        : t("resetInvalid"),
    );
  }
  return (
    <AuthShell eyebrow={t("recovery")} title={t("choosePassword")}>
      <form onSubmit={submit}>
        <label className="mt-6 block text-sm font-black">
          {t("newPassword")}
          <PasswordInput
            required
            minLength={8}
            name="password"
            autoComplete="new-password"
            wrapperClassName="mt-2"
            className="focus-ring min-h-13 w-full rounded-xl border border-border bg-background px-4 font-normal"
          />
        </label>
        <label className="mt-4 block text-sm font-black">
          {t("confirmNewPassword")}
          <PasswordInput
            required
            minLength={8}
            name="passwordConfirmation"
            autoComplete="new-password"
            wrapperClassName="mt-2"
            className="focus-ring min-h-13 w-full rounded-xl border border-border bg-background px-4 font-normal"
          />
        </label>
        {message ? (
          <p role="status" className="studio-notice mt-4 p-3 text-sm">
            {message}
          </p>
        ) : null}
        {completed ? (
          <a
            href="/auth/sign-in"
            className="studio-button studio-button--primary focus-ring mt-6 flex min-h-13 w-full items-center justify-center px-5 font-black"
          >
            {t("backSignIn")}
          </a>
        ) : (
          <button
            disabled={busy}
            className="studio-button studio-button--primary focus-ring mt-6 min-h-13 w-full px-5 font-black disabled:opacity-60"
          >
            {busy ? t("updating") : t("updatePassword")}
          </button>
        )}
      </form>
    </AuthShell>
  );
}
