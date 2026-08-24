export type ToastVariant = "success" | "error" | "warning";

export const TOAST_PRESENTATION = {
  success: { icon: "✓", container: "border-[#b8dfc4] bg-[#effaf2] text-success", iconBackground: "bg-[#d7f1de]" },
  error: { icon: "×", container: "border-[#efc8bf] bg-[#fff1ed] text-danger", iconBackground: "bg-[#f8d9d2]" },
  warning: { icon: "!", container: "border-[#ead5a4] bg-[#fff8e7] text-warning", iconBackground: "bg-[#f6e6bd]" },
} as const satisfies Record<ToastVariant, { icon: string; container: string; iconBackground: string }>;

export function Toast({ message, variant }: { message: string; variant: ToastVariant }) {
  const presentation = TOAST_PRESENTATION[variant];
  const isError = variant === "error";
  return (
    <div data-toast-variant={variant} role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={`fixed bottom-5 left-1/2 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-[0_18px_45px_rgba(20,15,35,.16)] sm:bottom-6 ${presentation.container}`}>
      <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-sm leading-none ${presentation.iconBackground}`}>{presentation.icon}</span>
      <span>{message}</span>
    </div>
  );
}
