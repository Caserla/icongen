import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { siteConfig } from "@/lib/site";

export function MarketingHeader() {
  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="text-lg font-extrabold tracking-tight">{siteConfig.name}</Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted sm:flex" aria-label="Main navigation">
          <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/icons" className="hover:text-foreground">My Icons</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/auth/sign-in" variant="quiet">Sign in</ButtonLink>
          <ButtonLink href="/create">Create icons</ButtonLink>
        </div>
      </div>
    </header>
  );
}
