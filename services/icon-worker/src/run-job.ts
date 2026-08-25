import { processGenerationJob } from "@icongen/backend-core";
import { loadConfig } from "./config";
import { createDependencies } from "./dependencies";

const jobId = process.argv[2];
if (!jobId) throw new Error("Usage: npm run process-job -- <job-id>");

const config = loadConfig();
const dependencies = createDependencies(config);

try {
  await processGenerationJob(jobId, dependencies);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown generation error";
  dependencies.logger.error("Local generation job failed", { jobId, error: message });
  await dependencies.repository.markFailedAndRefund(jobId, "GENERATION_FAILED", message);
  process.exitCode = 1;
}
