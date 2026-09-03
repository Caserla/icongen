import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card-polish paper-panel rounded-[6px] border border-border p-6 ${className}`}>{children}</section>;
}
