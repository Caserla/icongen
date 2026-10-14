export function createIconGenerationLimiter(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Generation limit must be positive");
  let active = 0;
  const waiting: Array<() => void> = [];

  return async function withSlot<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw signal.reason;
    await new Promise<void>((resolve, reject) => {
      const grant = () => {
        signal.removeEventListener("abort", cancel);
        active += 1;
        resolve();
      };
      const cancel = () => {
        const index = waiting.indexOf(grant);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal.reason);
      };
      if (active < limit && waiting.length === 0) grant();
      else { waiting.push(grant); signal.addEventListener("abort", cancel, { once: true }); }
    });
    try {
      if (signal.aborted) throw signal.reason;
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

// Shared by all icon groups on this page, including manual retries.
export const withIconGenerationSlot = createIconGenerationLimiter(2);
