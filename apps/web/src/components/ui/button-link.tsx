import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

const variants = {
  primary: "bg-brand text-white shadow-[0_4px_0_#4930c9] hover:bg-brand-strong active:translate-y-[3px] active:shadow-[0_1px_0_#4930c9]",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  quiet: "text-muted hover:bg-surface-muted hover:text-foreground",
};

export function ButtonLink({ href, children, variant = "primary", className = "" }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold transition ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
