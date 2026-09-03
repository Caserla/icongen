import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config";
import { logger } from "./adapters/logger";

const config = loadConfig();
const client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pollMs = Math.max(500, Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000));
const heartbeatPath = process.env.WORKER_HEARTBEAT_PATH ?? "/tmp/icongen-worker-heartbeat";
let stopping = false;

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function nextWork() {
  const edit = await client.from("generation_variant_revisions").select("id").eq("status", "queued").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (edit.error) throw edit.error;
  if (edit.data) return { script: "process-edit", id: edit.data.id } as const;
  const job = await client.from("generation_jobs").select("id").eq("status", "queued").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (job.error) throw job.error;
  return job.data ? ({ script: "process-job", id: job.data.id } as const) : null;
}

async function runChild(script: "process-job" | "process-edit", id: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", script, "--", id], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code ?? "unknown"}`)));
  });
}

logger.info("Worker daemon started", { pollMs });
while (!stopping) {
  try {
    await writeFile(heartbeatPath, new Date().toISOString(), "utf8");
    const work = await nextWork();
    if (work) await runChild(work.script, work.id);
    else await new Promise((resolve) => setTimeout(resolve, pollMs));
  } catch (error) {
    logger.error("Worker daemon iteration failed", { error: error instanceof Error ? error.message : "Unknown worker error" });
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
logger.info("Worker daemon stopped");
