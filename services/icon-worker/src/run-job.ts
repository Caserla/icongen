import {
  IncompleteGenerationJobSnapshotError,
  processGenerationJob,
} from "@icongen/backend-core";
import { loadConfig } from "./config";
import { createDependencies } from "./dependencies";

const jobId = process.argv[2];
if (!jobId) throw new Error("Usage: npm run process-job -- <job-id>");

const config = loadConfig();
const dependencies = createDependencies(config);

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
}
