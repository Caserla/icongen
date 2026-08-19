import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Pricing" };

const packs = [
  { name: "Starter", credits: "40 credits", note: "For testing your first ideas" },
  { name: "Maker", credits: "120 credits", note: "For active product exploration" },
  { name: "Studio", credits: "300 credits", note: "For multiple product concepts" },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16">
      <PageHeader eyebrow="Credit packs" title="Pay for the generations you need" description="Pricing remains configurable until model costs and generation quality are validated. Stripe Checkout will handle payment." />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {packs.map((pack) => (
          <Card key={pack.name}>
            <p className="text-sm font-bold text-brand">{pack.name}</p>
            <h2 className="mt-3 text-3xl font-extrabold">{pack.credits}</h2>
            <p className="mt-2 min-h-14 text-sm leading-6 text-muted">{pack.note}</p>
            <ButtonLink href="/auth/sign-in" className="mt-5 w-full">Choose pack</ButtonLink>
          </Card>
        ))}
      </div>
    </main>
  );
}
