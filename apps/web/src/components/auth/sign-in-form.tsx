"use client";

import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { PasswordInput } from "@/components/ui/password-input";
import { Toast } from "@/components/ui/toast";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/safe-next";

type SocialProvider = "google" | "github";

export function SignInForm({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch, () => "");
  const params = new URLSearchParams(search);
  const nextPath = safeNextPath(params.get("next"));
  const authUnavailable = params.get("reason") === "auth_unavailable";
  const reasonQuery = authUnavailable ? "&reason=auth_unavailable" : "";

  async function signInWithProvider(provider: SocialProvider) {
    setSocialBusy(provider);
    setError("");
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
      setError(t("socialSignInFailed")); setSocialBusy(null); return;
    }
    const supabase = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl.toString() } });
    if (oauthError) { setError(t("socialSignInFailed")); setSocialBusy(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/sign-in", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), next: nextPath }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setError(!response || response.status >= 500 || data?.error?.code === "AUTH_SERVICE_UNAVAILABLE" ? t("authUnavailable") : t("invalidLogin"));
      setBusy(false);
      return;
    }
    if (!data || typeof data.next !== "string") {
      setError(t("authUnavailable")); setBusy(false); return;
    }
    window.location.assign(safeNextPath(data.next));
  }

  return (
    <form onSubmit={submit} className={`w-full max-w-[440px] ${className}`.trim()}>
      <h1 className="mb-6 flex w-full justify-center text-center text-[15px] font-black tracking-[.02em]">{t("signInCreate")}</h1>
      {authUnavailable ? <p role="status" className="studio-notice mt-5 p-3 text-sm text-muted">{t("authUnavailable")}</p> : null}
      <div className="flex items-center justify-center gap-4">
        <SocialButton provider="google" label={t("continueWithGoogle")} busy={socialBusy === "google"} disabled={Boolean(socialBusy) || busy || authUnavailable} onClick={() => signInWithProvider("google")} />
        <SocialButton provider="github" label={t("continueWithGithub")} busy={socialBusy === "github"} disabled={Boolean(socialBusy) || busy || authUnavailable} onClick={() => signInWithProvider("github")} />
      </div>
      <div className="my-7 flex items-center gap-3 text-[11px] font-black uppercase tracking-[.12em] text-muted"><span className="h-px flex-1 bg-border" /><span>{t("orContinueWithEmail")}</span><span className="h-px flex-1 bg-border" /></div>
      <Field label={t("email")} name="email" type="email" autoComplete="email" />
      <div className="mt-5 flex justify-between text-sm font-extrabold"><span>{t("password")}</span><Link href={`/auth/forgot-password?next=${encodeURIComponent(nextPath)}${reasonQuery}`} className="text-xs underline">{t("forgot")}</Link></div>
      <PasswordInput required name="password" autoComplete="current-password" placeholder={t("password")} wrapperClassName="auth-login-input-shell mt-2" className="min-h-14 w-full rounded-[18px] border border-border bg-black px-7 text-base outline-none" />
      {error ? <Toast message={error} variant="error" /> : null}
      <button disabled={busy || Boolean(socialBusy) || authUnavailable} className="studio-button studio-button--primary focus-ring mt-6 min-h-14 w-full px-5 font-black disabled:cursor-not-allowed disabled:opacity-50">{busy ? t("signingIn") : t("continue")}</button>
      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted">{t("newHere")} <Link href={`/auth/sign-up?next=${encodeURIComponent(nextPath)}${reasonQuery}`} className="font-black text-foreground underline">{t("createAccount")}</Link></p>
    </form>
  );
}

function SocialButton({ provider, label, busy, disabled, onClick }: { provider: SocialProvider; label: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} aria-label={label} title={label} className="auth-social-button focus-ring grid size-14 shrink-0 place-items-center rounded-full border border-white/20 bg-[#101010] text-white transition-[background-color,border-color,transform] duration-200 hover:border-white/45 hover:bg-[#1d1d1d] active:scale-[.96] disabled:cursor-not-allowed disabled:opacity-50"><Image src={provider === "google" ? "/brands/google-g.svg" : "/brands/github-mark.svg"} alt="" width={32} height={32} style={{ width: 32, height: 32 }} className={`shrink-0 ${busy ? "animate-pulse" : ""}`} /></button>;
}

function Field({ label, name, type, autoComplete }: { label: string; name: string; type: string; autoComplete: string }) {
  return <label className="mt-8 block text-sm font-extrabold">{label}<span className="auth-login-input-shell mt-2 block"><input required name={name} type={type} autoComplete={autoComplete} placeholder={label} className="min-h-14 w-full rounded-[18px] border border-border bg-black px-7 text-base font-normal outline-none" /></span></label>;
}

function subscribeToLocation() { return () => undefined; }
function getLocationSearch() { return window.location.search; }
