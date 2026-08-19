import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { mockJobs } from "@/features/generation/mock-data";

export const metadata: Metadata = { title: "Generation details" };

export default async function IconJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = mockJobs.find((item) => item.id === jobId);
  if (!job) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader eyebrow="Generation job" title="Four icon directions" description={job.description} />
        <StatusBadge status={job.status} />
      </div>
      {job.status === "completed" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {job.results.map((result, index) => (
            <Card key={result.id}>
              <div className="grid aspect-square place-items-center rounded-3xl bg-surface-muted text-5xl font-black text-brand">{String.fromCharCode(65 + index)}</div>
              <div className="mt-5 flex items-center justify-between">
                <span className="font-semibold">Direction {index + 1}</span>
                <ButtonLink href="#" variant="secondary">Download PNG</ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card><p className="font-semibold">Your icons are being created.</p><p className="mt-2 text-sm text-muted">You can leave this page and return from My Icons.</p></Card>
      )}
    </div>
  );
}
