import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";

const steps = [
  ["1", "Describe your app", "Share the product purpose, visual direction, and the feeling your icon should convey."],
  ["2", "Generate four directions", "One brief becomes four independent icon concepts in a single tracked job."],
  ["3", "Choose and download", "Review every result in your workspace and download the PNG you want to ship."],
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-7">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">AI app icon generator</p>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Four icon directions from one clear product brief.</h1>
          <p className="max-w-2xl text-lg leading-8 text-muted">Turn your app idea into distinct, production-minded visual options without starting from a blank canvas.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/create" className="min-h-12 px-6">Generate four icons</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" className="min-h-12 px-6">View credit packs</ButtonLink>
          </div>
        </div>
        <Card className="grid min-h-96 grid-cols-2 gap-4 bg-surface-muted">
          {["A", "B", "C", "D"].map((label) => (
            <div key={label} className="flex aspect-square items-center justify-center rounded-3xl border border-border bg-surface text-3xl font-black text-brand shadow-sm">{label}</div>
          ))}
        </Card>
      </section>
      <section className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-bold tracking-tight">A focused three-step workflow</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <Card key={number}>
                <span className="text-sm font-bold text-brand">STEP {number}</span>
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                <p className="mt-2 leading-7 text-muted">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
