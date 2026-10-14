import { readGenerationCheckpoint, saveGenerationCheckpoint, stableGenerationJson } from './generation-checkpoint';

let providerHealthyUntil = 0;

export class GenerationRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) { super(message); }
}
export function isSubjectGenerationFailure(error: unknown): boolean {
  return error instanceof GenerationRequestError && error.status === 422 && error.code !== 'INVALID_COLOR_PLAN';
}
export type GenerationOutcome = boolean | 'subject-failed';

/** Cold batches probe first; recent successful generation can use both slots immediately. */
export async function runGenerationBatch<T>(units: T[], signal: AbortSignal, run: (unit: T) => Promise<GenerationOutcome>) {
  let next = 0;
  let paused = false;
  const worker = async () => {
    while (!signal.aborted && !paused && next < units.length) {
      const unit = units[next++];
      if (await run(unit) === false) { paused = true; providerHealthyUntil = 0; }
    }
  };
  if (units.length && !signal.aborted && Date.now() >= providerHealthyUntil) {
    next = 1;
    if (await run(units[0]) === false) { paused = true; providerHealthyUntil = 0; }
  }
  if (!paused && !signal.aborted) await Promise.all([worker(), worker()]);
  return { paused, dispatched: next };
}

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const cancel = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

export async function requestGenerationJson<T>(url: string, body: unknown, signal: AbortSignal, checkpointScope?: string): Promise<T> {
  const scoped = url === '/api/generation/svg-icon' && checkpointScope && body && typeof body === 'object' && !('resume' in body) ? checkpointScope : undefined;
  const identity = scoped ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableGenerationJson(body)))), b => b.toString(16).padStart(2, '0')).join('') : '';
  const planCheckpoint = scoped ? readGenerationCheckpoint(scoped, identity) : undefined;
  const requestBody = planCheckpoint ? { ...body as object, planCheckpoint } : body;
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { method: url === '/api/generation/svg-icon' ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: AbortSignal.any([signal, AbortSignal.timeout(420_000)]) });
    } catch (error) {
      if (url === '/api/generation/svg-icon') providerHealthyUntil = 0;
      if (signal.aborted || attempt >= 2) throw error;
      await abortableDelay(3000 * 2 ** attempt, signal);
      continue;
    }
    const payload = await response.json().catch(() => null);
    if (response.ok && payload) {
      if (scoped) saveGenerationCheckpoint(scoped, identity);
      if (url === '/api/generation/svg-icon' && (typeof payload.svg === 'string' || (typeof payload.svgs?.outline === 'string' && typeof payload.svgs?.solid === 'string'))) providerHealthyUntil = Date.now() + 60_000;
      return payload as T;
    }
    if (url === '/api/generation/svg-icon' && response.status !== 422) providerHealthyUntil = 0;
    if (scoped && (payload?.planCheckpoint || payload?.error === 'INVALID_PLAN_CHECKPOINT')) {
      saveGenerationCheckpoint(scoped, identity, payload?.planCheckpoint);
    }
    const providerStatus = payload?.details?.providerStatus;
    const permanent = payload?.retryable === false || [400, 401, 403, 404].includes(providerStatus) || ['PROVIDER_UNAVAILABLE', 'INVALID_STYLE', 'INVALID_INPUT'].includes(payload?.error);
    const temporary = response.status === 429 || response.status >= 500;
    if (permanent || !temporary || attempt >= 2) throw new GenerationRequestError(payload?.message || `Request failed (${response.status})`, response.status, payload?.error);
    const retryAfter = Number(response.headers.get('Retry-After')) * 1000;
    await abortableDelay(Math.min(60_000, Math.max(3000 * 2 ** attempt, retryAfter || 0)), signal);
  }
}
