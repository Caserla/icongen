import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="Profile and credits" description="Identity, credit balance, and transaction history will be backed by Supabase and the immutable credit ledger." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><p className="text-sm font-semibold text-muted">Available credits</p><p className="mt-2 text-4xl font-extrabold">—</p><ButtonLink href="/pricing" className="mt-6">Buy credits</ButtonLink></Card>
        <Card><p className="text-sm font-semibold text-muted">Signed-in email</p><p className="mt-2 text-lg font-bold">Supabase Auth connection pending</p><p className="mt-3 text-sm leading-6 text-muted">Profile editing and account deletion will be implemented with the user-information module.</p></Card>
      </div>
    </div>
  );
}
