/** Stable JSON identity; object key order is irrelevant, array order is not. */
export function stableGenerationJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))) : entry);
}

const storageKey = "easy-icon:plan-checkpoints:v1";
type Entry = { scope: string; input: string; checkpoint: unknown; expiresAt: number };
let memory: Entry[] = [];
function entries(): Entry[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (Array.isArray(saved)) memory = saved.filter(e => e && typeof e.scope === "string" && typeof e.input === "string" && typeof e.expiresAt === "number");
  } catch { /* SSR, restricted storage or quota: retain the bounded in-memory cache. */ }
  memory = memory.filter(e => e.expiresAt > Date.now()).slice(-40);
  return memory;
}
export function readGenerationCheckpoint(scope: string, input: string) {
  return entries().find(e => e.scope === scope && e.input === input)?.checkpoint;
}
export function saveGenerationCheckpoint(scope: string, input: string, checkpoint?: unknown) {
  memory = entries().filter(e => e.scope !== scope);
  if (checkpoint) memory.push({ scope, input, checkpoint, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  memory = memory.slice(-40);
  while (memory.length && JSON.stringify(memory).length > 1_000_000) memory.shift();
  try { sessionStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Best effort, never fail the UI. */ }
}
