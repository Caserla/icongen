import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card-polish rounded-[22px] border border-border bg-surface p-6 ${className}`}>{children}</section>;
}
