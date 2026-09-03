import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetails } from "@/features/generation/components/job-details";
import { readGenerationJob } from "@/features/generation/server/generation-job-reader";
import { requireActiveUser } from "@/lib/auth/require-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Icon set results" };

export default async function IconJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [{ jobId }, user] = await Promise.all([params, requireActiveUser()]);
  const client = createAdminSupabaseClient();
  const job = await readGenerationJob(client, user.id, jobId, { includeAssets: false }).catch((error) => {
    console.error("Failed to read generation job", { jobId, error });
    return null;
  });
  if (!job) notFound();
  return <JobDetails initialJob={job}/>;
}
