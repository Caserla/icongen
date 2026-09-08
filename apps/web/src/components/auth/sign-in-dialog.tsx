"use client";

import { useEffect, useRef, useState } from "react";
import { SignInForm } from "@/components/auth/sign-in-form";
import { useLocale } from "@/components/i18n/locale-provider";

export function SignInDialog() {
  const { t, locale } = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    document.documentElement.classList.toggle("auth-dialog-open", open);
    return () => document.documentElement.classList.remove("auth-dialog-open");
  }, [open]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  function close() {
    if (!open || closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closeTimerRef.current = null;
    }, 360);
  }

  function show() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setClosing(false);
    setOpen(true);
  }

  return (
    <>
      <button type="button" className="marketing-sign-in hidden min-h-11 items-center justify-center px-4 py-2 text-sm font-extrabold sm:inline-flex" onClick={show}>
        {t("signIn")}
      </button>
      <dialog
        ref={dialogRef}
        className={`auth-studio auth-sign-in-dialog${closing ? " is-closing" : ""}`}
        aria-label={t("signInCreate")}
        onClose={() => { setOpen(false); setClosing(false); }}
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <button type="button" className="auth-sign-in-dialog__close" onClick={close} aria-label={locale === "zh" ? "关闭登录弹窗" : "Close sign-in dialog"}>
          <span aria-hidden="true">×</span>
        </button>
        <div className="auth-sign-in-dialog__content">
          <SignInForm />
        </div>
      </dialog>
    </>
  );
}
