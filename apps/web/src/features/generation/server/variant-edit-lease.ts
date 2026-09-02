export const QUEUED_EDIT_DISPATCH_TIMEOUT_MS = 2 * 60 * 1000;
// The worker refreshes `updated_at` every 30 seconds. Two missed minutes are
// enough to distinguish an interrupted worker from a slow image request while
// avoiding a long-lived phantom progress state after a server restart.
export const PROCESSING_EDIT_LEASE_TIMEOUT_MS = 2 * 60 * 1000;

export type ActiveVariantEdit = {
  id: string;
  status: "queued" | "processing";
  created_at: string;
  updated_at: string;
};

export function isVariantEditLeaseStale(edit: ActiveVariantEdit, now = Date.now()) {
  const timestamp = edit.status === "queued" ? edit.created_at : edit.updated_at;
  const timeout = edit.status === "queued"
    ? QUEUED_EDIT_DISPATCH_TIMEOUT_MS
    : PROCESSING_EDIT_LEASE_TIMEOUT_MS;
  return now - new Date(timestamp).getTime() >= timeout;
}

export function localVariantWorkerEnabled(env: NodeJS.ProcessEnv) {
  if (env.LOCAL_GENERATION_WORKER_ENABLED === "true") return true;
  if (env.LOCAL_GENERATION_WORKER_ENABLED === "false") return false;
  return env.NODE_ENV !== "production";
}
