import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetails } from "@/features/generation/components/job-details";
import { readGenerationJob } from "@/features/generation/server/generation-job-reader";
import { requireActiveUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { serverLogger } from "@/lib/security/server-log";

export const metadata: Metadata = { title: "Icon set results" };

export default async function IconJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [{ jobId }, user] = await Promise.all([params, requireActiveUser()]);
  const client = await createServerSupabaseClient();
  const job = await readGenerationJob(client, user.id, jobId, { includeAssets: false }).catch((error) => {
    serverLogger.error("generation_job_page_load_failed", { jobId, error });
    return null;
  });
  if (!job) notFound();
  return <JobDetails initialJob={job}/>;
}
