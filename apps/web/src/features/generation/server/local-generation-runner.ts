import { spawn } from "node:child_process";
import path from "node:path";

const activeJobs = new Set<string>();

export function startLocalGenerationJob(jobId: string) {
  if (process.env.NODE_ENV === "production" || activeJobs.has(jobId)) return;

  const workspaceRoot = process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
  activeJobs.add(jobId);

  const child = spawn(
    "npm",
    ["run", "process-job", "--workspace=@icongen/icon-worker", "--", jobId],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
      stdio: "inherit",
    },
  );

  child.once("error", (error) => {
    activeJobs.delete(jobId);
    console.error("Failed to start local generation worker", { jobId, message: error.message });
  });
  child.once("exit", (code) => {
    activeJobs.delete(jobId);
    if (code !== 0) console.error("Local generation worker exited unsuccessfully", { jobId, code });
  });
}
