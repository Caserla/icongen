import type { Metadata } from "next";
import { JobDetailsLoader } from "@/features/generation/components/job-details-loader";

export const metadata: Metadata = { title: "Icon details" };

export default async function IconJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <JobDetailsLoader jobId={jobId} />;
}
