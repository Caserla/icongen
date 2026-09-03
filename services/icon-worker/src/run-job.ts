import {
  IncompleteGenerationJobSnapshotError,
  processGenerationJob,
} from "@icongen/backend-core";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config";
import { createDependencies } from "./dependencies";

const jobId = process.argv[2];
if (!jobId) throw new Error("Usage: npm run process-job -- <job-id>");

const config = loadConfig();
const dependencies = createDependencies(config);
const workerId = process.env.WORKER_INSTANCE_ID;
const leaseSeconds = Math.min(900, Math.max(30, Number(process.env.WORKER_LEASE_SECONDS ?? 120)));
const leaseClient = workerId
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const leaseTimer = leaseClient && workerId
  ? setInterval(() => {
      void leaseClient.from("generation_jobs").update({
        worker_lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", jobId).eq("worker_lease_owner", workerId).eq("status", "processing");
    }, Math.min(20_000, Math.floor(leaseSeconds * 1000 / 3)))
  : undefined;
leaseTimer?.unref();

const MAX_INCOMPLETE_JOB_RELOADS = 3;

try {
  for (let reload = 0; reload <= MAX_INCOMPLETE_JOB_RELOADS; reload += 1) {
    try {
      await processGenerationJob(jobId, dependencies);
      break;
    } catch (error) {
      const receivedLateRetry =
        error instanceof IncompleteGenerationJobSnapshotError;
      if (!receivedLateRetry || reload === MAX_INCOMPLETE_JOB_RELOADS)
        throw error;

      dependencies.logger.info(
        "Reloading generation job after variants entered the queue during processing",
        { jobId, reload: reload + 1 },
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown generation error";
  dependencies.logger.error("Local generation job failed", { jobId, error: message });
  await dependencies.repository.markFailedAndRefund(jobId, "GENERATION_FAILED", message);
  process.exitCode = 1;
} finally {
  if (leaseTimer) clearInterval(leaseTimer);
}
