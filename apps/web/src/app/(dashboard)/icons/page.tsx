import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { mockJobs } from "@/features/generation/mock-data";

export const metadata: Metadata = { title: "My Icons" };

export default function IconsPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Workspace" title="My Icons" description="Every generation job remains available here, including work still processing or requiring attention." />
      <div className="grid gap-4">
        {mockJobs.map((job) => (
          <Link key={job.id} href={`/icons/${job.id}`}>
            <Card className="flex items-center justify-between gap-5 transition hover:border-brand">
              <div>
                <p className="font-semibold">{job.description}</p>
                <p className="mt-1 text-sm text-muted">{new Date(job.createdAt).toLocaleString("en-US")}</p>
              </div>
              <StatusBadge status={job.status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
