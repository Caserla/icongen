"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { useLocale } from "@/components/i18n/locale-provider";
import { validateSignUp, type SignUpErrors, type SignUpFields } from "@/features/auth/validate-sign-up";
import { PasswordInput } from "@/components/ui/password-input";

const initialFields: SignUpFields = { email: "", password: "", passwordConfirmation: "", acceptedTerms: false };

export default function SignUpPage() {
  const { locale, t } = useLocale();
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch, () => "");
  const params = new URLSearchParams(search);
  const nextPath = params.get("next") ?? "/create";
  const authUnavailable = params.get("reason") === "auth_unavailable";
  function update<K extends keyof SignUpFields>(key: K, value: SignUpFields[K]) { setFields((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("");
    const nextErrors = validateSignUp(fields, locale); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    const response = await fetch("/api/auth/sign-up", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fields.email, password: fields.password, acceptedTerms: true, next: nextPath }) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) return setStatus(t("signupFailed"));
    const data = await response.json();
    if (data.requiresEmailVerification) { setFields(initialFields); return setStatus(t("checkInbox")); }
    window.location.assign(data.next);
  }

  const reasonQuery = authUnavailable ? "&reason=auth_unavailable" : "";
  return <AuthShell eyebrow={t("startCreating")} title={t("createYourAccount")}><form onSubmit={submit} noValidate>{authUnavailable ? <p role="status" className="mt-5 rounded-[4px] border border-border bg-background p-3 text-sm text-muted">{t("authUnavailable")}</p> : null}<Field label={t("email")} name="email" type="email" autoComplete="email" value={fields.email} error={errors.email} onChange={(value) => update("email", value)}/><Field label={t("password")} name="password" type="password" autoComplete="new-password" value={fields.password} error={errors.password} onChange={(value) => update("password", value)}/><Field label={t("confirmPassword")} name="passwordConfirmation" type="password" autoComplete="new-password" value={fields.passwordConfirmation} error={errors.passwordConfirmation} onChange={(value) => update("passwordConfirmation", value)}/><p className="mt-2 text-xs text-muted">{t("passwordHint")}</p><label className="mt-5 flex items-start gap-3 text-sm text-muted"><input name="acceptedTerms" type="checkbox" checked={fields.acceptedTerms} onChange={(event) => update("acceptedTerms", event.target.checked)} className="mt-1"/><span>{t("acceptTerms")}</span></label>{errors.acceptedTerms ? <p className="mt-2 text-xs text-danger">{errors.acceptedTerms}</p> : null}{status ? <p role="status" aria-live="polite" className="mt-4 rounded-[4px] bg-background p-3 text-sm">{status}</p> : null}<button disabled={busy || authUnavailable} className="mt-6 min-h-13 w-full rounded-[4px] bg-brand font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("creating") : t("createAccount")}</button><p className="mt-6 text-center text-sm text-muted">{t("alreadyAccount")} <Link className="font-black text-foreground underline" href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}${reasonQuery}`}>{t("signIn")}</Link></p></form></AuthShell>;
}

function Field({ label, name, type, autoComplete, value, error, onChange }: { label: string; name: string; type: string; autoComplete: string; value: string; error?: string; onChange: (value: string) => void }) {
  const common={required:true,name,autoComplete,value,"aria-invalid":Boolean(error),"aria-describedby":error?`${name}-error`:undefined,onChange:(event:ChangeEvent<HTMLInputElement>)=>onChange(event.target.value),className:"min-h-13 w-full rounded-[4px] border border-border bg-background px-4 font-normal"};
  return <label className="mt-5 block text-sm font-black">{label}{type==="password"?<PasswordInput {...common} wrapperClassName="mt-2"/>:<input {...common} type={type} className={`mt-2 ${common.className}`}/>} {error ? <span id={`${name}-error`} className="mt-2 block text-xs font-normal text-danger">{error}</span> : null}</label>;
}

function subscribeToLocation() { return () => undefined; }
function getLocationSearch() { return window.location.search; }
