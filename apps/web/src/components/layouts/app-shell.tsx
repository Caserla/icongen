import Link from "next/link";
import type { ReactNode } from "react";
import { siteConfig } from "@/lib/site";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
          <Link href="/" className="text-lg font-extrabold tracking-tight">{siteConfig.name}</Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto" aria-label="Workspace navigation">
            {siteConfig.navigation.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/account" className="rounded-full border border-border bg-surface-muted px-3 py-2 text-sm font-semibold">Account</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
    </div>
  );
}
