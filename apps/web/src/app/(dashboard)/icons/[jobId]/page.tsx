import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobDetails } from "@/features/generation/components/job-details";
import { readGenerationJob } from "@/features/generation/server/generation-job-reader";
import { requireActiveUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Generation results" };

export default async function IconJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [{ jobId }, user, client] = await Promise.all([params, requireActiveUser(), createServerSupabaseClient()]);
  const job = await readGenerationJob(client, user.id, jobId).catch(() => null);
  if (!job) notFound();
  return <JobDetails initialJob={job}/>;
}
