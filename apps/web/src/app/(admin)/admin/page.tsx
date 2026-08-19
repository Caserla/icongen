import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operations" title="Admin workspace" description="A protected surface for user, generation, payment, credit-ledger, and audit-log investigations." />
      <div className="grid gap-4 md:grid-cols-3">
        {['Users', 'Generation jobs', 'Payments & credits'].map((label) => <Card key={label}><h2 className="font-bold">{label}</h2><p className="mt-2 text-sm text-muted">Search and operational actions will be added with role checks and audit logging.</p></Card>)}
      </div>
    </div>
  );
}
