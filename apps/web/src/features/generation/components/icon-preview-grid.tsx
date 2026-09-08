import type { ReactNode } from "react";

/** Decorative construction guides only. Never pass this layer to an exporter. */
export function IconPreviewGrid({ children, className = "" }: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} icon-preview-grid`}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 240 240"
        className="icon-preview-grid__guides"
        fill="none"
        stroke="var(--preview-guide-color, rgba(255,255,255,0.10))"
        strokeWidth="1"
      >
        <rect x="1" y="1" width="238" height="238" rx="58" />
        <rect x="17" y="17" width="206" height="206" rx="42" />
        <circle cx="120" cy="120" r="103" />
        <circle cx="120" cy="120" r="72" />
        <path d="M36 36 204 204M204 36 36 204M1 120h238M120 1v238M1 78h238M1 162h238M78 1v238M162 1v238M17 17h206v206H17Z" />
      </svg>
      <div className="icon-preview-grid__content">{children}</div>
    </div>
  );
}
