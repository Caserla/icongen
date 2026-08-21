import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetails } from "@/features/generation/components/job-details";
import { mockJobs } from "@/features/generation/mock-data";

export const metadata: Metadata = { title: "Generation details" };

export default async function IconJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = mockJobs.find((item) => item.id === jobId);
  if (!job) notFound();

  return <JobDetails job={job} />;
}
