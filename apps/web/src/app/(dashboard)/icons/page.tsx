import type { Metadata } from "next";
import { IconJobList } from "@/features/generation/components/icon-job-list";
import { readGenerationJobs } from "@/features/generation/server/generation-job-list-reader";
import { requireActiveUser } from "@/lib/auth/require-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "My Icons" };

export default async function IconsPage() {
  const user = await requireActiveUser();
  const jobs = await readGenerationJobs(createAdminSupabaseClient(), user.id);
  return <IconJobList jobs={jobs}/>;
}
