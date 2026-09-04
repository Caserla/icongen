import type { GenerationJobV2 } from "@icongen/shared";

export const GENERATION_STALL_WARNING_MS = 5 * 60 * 1000;

export function isGenerationStalled(
  job: Pick<GenerationJobV2, "status" | "createdAt" | "updatedAt">,
  now = Date.now(),
) {
  if (["completed", "partial", "failed"].includes(job.status)) return false;
  const lastProgressAt = Date.parse(job.updatedAt ?? job.createdAt);
  return (
    Number.isFinite(lastProgressAt) &&
    now - lastProgressAt >= GENERATION_STALL_WARNING_MS
  );
}

export function hasRepeatedPollingFailures(failureCount: number) {
  return failureCount >= 3;
}
