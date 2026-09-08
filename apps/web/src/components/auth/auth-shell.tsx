import type { ReactNode } from "react";
import { AuthHeader } from "@/components/auth/auth-header";
export function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-studio min-h-screen">
      <AuthHeader />
      <section className="studio-panel page-paper-enter relative mx-auto mt-5 max-w-lg overflow-hidden p-7 sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.14em] text-accent">
          {eyebrow}
        </p>
        <h1 className="display-serif mt-3 text-4xl leading-tight tracking-[-.045em] sm:text-5xl">
          {title}
        </h1>
        {children}
      </section>
    </main>
  );
}
