export function normalizeWorkerDuration(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

export function parseClaimedTask(
  rows: unknown,
): { script: "process-job" | "process-edit"; id: string } | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  if ((row.task_type !== "job" && row.task_type !== "edit") || typeof row.task_id !== "string") {
    throw new Error("Worker claim RPC returned an invalid task");
  }
  return {
    script: row.task_type === "edit" ? "process-edit" : "process-job",
    id: row.task_id,
  };
}

export type WorkerLeaseRow = {
  worker_lease_owner: string | null;
  worker_lease_expires_at: string | null;
};

export function hasActiveWorkerLease(
  row: WorkerLeaseRow | null,
  workerId: string,
  now = Date.now(),
) {
  if (!row || row.worker_lease_owner !== workerId || !row.worker_lease_expires_at) return false;
  const expiresAt = Date.parse(row.worker_lease_expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
