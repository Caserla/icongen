import { spawn } from "node:child_process";
import path from "node:path";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { localVariantWorkerEnabled } from "./variant-edit-lease";

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
    console.error("Failed to start local generation worker", { jobId, message: error.message });
  });
  child.once("exit", (code) => {
    activeJobs.delete(jobId);
    if (code !== 0) console.error("Local generation worker exited unsuccessfully", { jobId, code });
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
  const workspaceRoot = process.env.INIT_CWD ?? path.resolve(process.cwd(), "../..");
  const child = spawn(
    "npm",
    ["run", "process-edit", "--workspace=@icongen/icon-worker", "--", editId],
    {
      cwd: workspaceRoot,
      env: { ...process.env, SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL },
      stdio: "inherit",
    },
  );
  const markDispatchFailed = async (message: string) => {
    console.error("Failed to start local variant edit worker", { editId, message });
    const now = new Date().toISOString();
    await createAdminSupabaseClient().from("generation_variant_revisions").update({
      status: "failed",
      error_code: "VARIANT_EDIT_DISPATCH_FAILED",
      error_message: message.slice(0, 1000),
      completed_at: now,
      updated_at: now,
    }).eq("id", editId).in("status", ["queued", "processing"]);
  };
  child.once("error", (error) => void markDispatchFailed(error.message));
  child.once("exit", (code) => {
    if (code !== 0) void markDispatchFailed(`Local variant edit worker exited with code ${code ?? "unknown"}`);
  });
}
