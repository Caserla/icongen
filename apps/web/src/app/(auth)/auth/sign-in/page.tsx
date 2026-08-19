import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <Link href="/" className="text-lg font-extrabold">IconGen</Link>
        <h1 className="mt-10 text-3xl font-bold tracking-tight">Sign in to your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Authentication UI is ready for the Supabase Auth integration.</p>
        <form className="mt-8 space-y-5">
          <label className="block text-sm font-semibold">
            Email address
            <input type="email" name="email" autoComplete="email" placeholder="you@example.com" className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface px-4 font-normal" />
          </label>
          <button type="submit" className="min-h-12 w-full rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-strong">Continue with email</button>
        </form>
        <p className="mt-6 text-xs leading-5 text-muted">Password or magic-link behavior will be selected during the authentication module design.</p>
      </section>
    </main>
  );
}
