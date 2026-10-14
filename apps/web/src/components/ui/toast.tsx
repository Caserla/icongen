"use client";

import { useEffect, useState } from "react";

export type ToastVariant = "success" | "error" | "warning";

export const TOAST_PRESENTATION = {
  success: {
    icon: "✓",
    container: "studio-notice--success",
    iconBackground: "studio-notice__icon",
  },
  error: {
    icon: "×",
    container: "studio-notice--error",
    iconBackground: "studio-notice__icon",
  },
  warning: {
    icon: "!",
    container: "studio-notice--warning",
    iconBackground: "studio-notice__icon",
  },
} as const satisfies Record<
  ToastVariant,
  { icon: string; container: string; iconBackground: string }
>;

export function Toast({
  message,
  variant,
  placement = "center",
}: {
  message: string;
  variant: ToastVariant;
  placement?: "bottom" | "center";
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [message, variant]);
  if (!visible || !message?.trim()) return null;
  const presentation = TOAST_PRESENTATION[variant];
  const isError = variant === "error";
  return (
    <div
      data-toast-variant={variant}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={`app-toast studio-notice fixed left-1/2 z-[100] flex w-max min-w-[240px] max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center justify-center gap-3 px-5 py-4 text-center text-sm font-semibold ${placement === "center" ? "top-1/2 -translate-y-1/2" : "bottom-5 sm:bottom-6"} ${presentation.container}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center rounded-full text-sm leading-none ${presentation.iconBackground}`}
      >
        {presentation.icon}
      </span>
      <span className="app-toast__message">{message}</span>
    </div>
  );
}
