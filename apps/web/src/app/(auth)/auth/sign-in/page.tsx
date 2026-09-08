"use client";

import { AuthHeader } from "@/components/auth/auth-header";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="auth-studio h-dvh overflow-hidden">
      <AuthHeader />
      <div className="h-[calc(100dvh-72px)] px-3 pb-3 pt-5 sm:px-5 sm:pb-5">
        <div className="studio-panel mx-auto grid h-full max-w-7xl overflow-hidden lg:grid-cols-2">
          <section aria-hidden="true" className="hidden bg-[#101010] lg:block" />
          <section className="grid min-h-0 items-start justify-items-center overflow-y-auto px-7 pb-7 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-14 sm:pb-14 sm:pt-10">
            <SignInForm />
          </section>
        </div>
      </div>
    </main>
  );
}
