export type ToastVariant = "success" | "error" | "warning";

export const TOAST_PRESENTATION = {
  success: { icon: "✓", container: "studio-notice--success", iconBackground: "studio-notice__icon" },
  error: { icon: "×", container: "studio-notice--error", iconBackground: "studio-notice__icon" },
  warning: { icon: "!", container: "studio-notice--warning", iconBackground: "studio-notice__icon" },
} as const satisfies Record<ToastVariant, { icon: string; container: string; iconBackground: string }>;

export function Toast({ message, variant, placement = "bottom" }: { message: string; variant: ToastVariant; placement?: "bottom" | "center" }) {
  const presentation = TOAST_PRESENTATION[variant];
  const isError = variant === "error";
  return (
    <div data-toast-variant={variant} role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={`studio-notice fixed left-1/2 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 px-4 py-3 text-sm font-bold ${placement === "center" ? "top-1/2 -translate-y-1/2" : "bottom-5 sm:bottom-6"} ${presentation.container}`}>
      <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-sm leading-none ${presentation.iconBackground}`}>{presentation.icon}</span>
      <span>{message}</span>
    </div>
  );
}
