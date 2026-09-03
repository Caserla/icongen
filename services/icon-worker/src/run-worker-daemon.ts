import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config";
import { logger } from "./adapters/logger";
import { normalizeWorkerDuration, parseClaimedTask } from "./worker-runtime";

const config = loadConfig();
const client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pollMs = normalizeWorkerDuration(process.env.WORKER_POLL_INTERVAL_MS, 2000, 500, 60_000);
const heartbeatPath = process.env.WORKER_HEARTBEAT_PATH ?? "/tmp/icongen-worker-heartbeat";
const workerId = process.env.WORKER_INSTANCE_ID ?? randomUUID();
const leaseSeconds = normalizeWorkerDuration(process.env.WORKER_LEASE_SECONDS, 120, 30, 900);
let stopping = false;

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function nextWork() {
  const result = await client.rpc("claim_next_worker_task", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (result.error) throw result.error;
  return parseClaimedTask(result.data);
}

async function runChild(script: "process-job" | "process-edit", id: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", script, "--", id], {
      cwd: process.cwd(),
      env: { ...process.env, WORKER_INSTANCE_ID: workerId, WORKER_LEASE_SECONDS: String(leaseSeconds) },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code ?? "unknown"}`)));
  });
}

logger.info("Worker daemon started", { pollMs, workerId, leaseSeconds });
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
