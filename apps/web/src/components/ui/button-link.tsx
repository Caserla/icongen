import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
};

const variants = {
  primary: "studio-button studio-button--primary",
  secondary: "studio-button studio-button--secondary",
  quiet: "text-muted hover:bg-surface-muted hover:text-foreground",
};

export function ButtonLink({ href, children, variant = "primary", className = "" }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`focus-ring inline-flex min-h-11 items-center justify-center px-4 py-2 text-sm font-extrabold transition ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
