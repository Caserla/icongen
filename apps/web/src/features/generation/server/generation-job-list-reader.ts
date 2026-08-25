import type { GenerationJobStatusV2 } from "@icongen/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerationJobListItem = {
  id: string;
  status: GenerationJobStatusV2;
  createdAt: string;
  subjects: { name: string; position: number }[];
};

const demoJobIds = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

export async function readGenerationJobs(client: SupabaseClient, userId: string): Promise<GenerationJobListItem[]> {
  const { data: jobs, error: jobsError } = await client.from("generation_jobs")
    .select("id,status,created_at").eq("user_id", userId)
    .not("id", "in", `(${demoJobIds.join(",")})`)
    .order("created_at", { ascending: false });
  if (jobsError) throw jobsError;
  if (!jobs?.length) return [];

  const { data: subjects, error: subjectsError } = await client.from("generation_subjects")
    .select("job_id,name,position").in("job_id", jobs.map((job) => job.id)).order("position", { ascending: true });
  if (subjectsError) throw subjectsError;

  return jobs.map((job) => ({
    id: job.id,
    status: job.status as GenerationJobStatusV2,
    createdAt: new Date(job.created_at).toISOString(),
    subjects: (subjects ?? []).filter((subject) => subject.job_id === job.id)
      .map((subject) => ({ name: subject.name, position: subject.position })),
  }));
}
