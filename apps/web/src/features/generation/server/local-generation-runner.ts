import { spawn } from "node:child_process";
import path from "node:path";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { localVariantWorkerEnabled } from "./variant-edit-lease";
import { serverLogger } from "@/lib/security/server-log";

const activeJobs = new Set<string>();
const scheduledJobs = new Map<string, ReturnType<typeof setTimeout>>();

function spawnLocalGenerationJob(jobId: string, workspaceRoot: string) {
  scheduledJobs.delete(jobId);
  if (activeJobs.has(jobId)) {
    scheduledJobs.set(
      jobId,
      setTimeout(() => spawnLocalGenerationJob(jobId, workspaceRoot), 750),
    );
    return;
  }

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
    serverLogger.error("local_generation_worker_start_failed", {
      jobId,
      message: error.message,
    });
  });
  child.once("exit", (code) => {
    activeJobs.delete(jobId);
    if (code !== 0)
      serverLogger.error("local_generation_worker_exit_failed", {
        jobId,
        code,
      });
  });
}

export function startLocalGenerationJob(jobId: string) {
  if (!localVariantWorkerEnabled(process.env)) return;

  const workspaceRoot =
    process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
  const scheduled = scheduledJobs.get(jobId);
  if (scheduled) clearTimeout(scheduled);

  // A user may retry several failed variants in quick succession. Coalesce
  // those writes before the worker reads its job snapshot, otherwise a later
  // variant can miss the active run and be marked as an incomplete subject.
  scheduledJobs.set(
    jobId,
    setTimeout(() => spawnLocalGenerationJob(jobId, workspaceRoot), 750),
  );
}

export function startLocalVariantEdit(editId: string) {
  if (!localVariantWorkerEnabled(process.env)) return;
  const workspaceRoot =
    process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
  const child = spawn(
    "npm",
    ["run", "process-edit", "--workspace=@icongen/icon-worker", "--", editId],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
      stdio: "inherit",
    },
  );
  const markDispatchFailed = async (message: string) => {
    serverLogger.error("local_variant_edit_worker_start_failed", {
      editId,
      message,
    });
    const now = new Date().toISOString();
    await createAdminSupabaseClient()
      .from("generation_variant_revisions")
      .update({
        status: "failed",
        error_code: "VARIANT_EDIT_DISPATCH_FAILED",
        error_message:
          "The processing worker could not be started. Please try again.",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", editId)
      .in("status", ["queued", "processing"]);
  };
  child.once("error", (error) => void markDispatchFailed(error.message));
  child.once("exit", (code) => {
    if (code !== 0)
      void markDispatchFailed(
        `Local variant edit worker exited with code ${code ?? "unknown"}`,
      );
  });
}
