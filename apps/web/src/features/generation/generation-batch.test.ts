import test from 'node:test';
import assert from 'node:assert/strict';
import { runGenerationBatch, requestGenerationJson, isSubjectGenerationFailure, GenerationRequestError } from './generation-batch';
import { readGenerationCheckpoint, saveGenerationCheckpoint, stableGenerationJson } from './generation-checkpoint';

test('subject validation failure does not pause or skip later subjects', async () => {
  const called: number[] = [];
  const result = await runGenerationBatch([0, 1, 2, 3], new AbortController().signal, async i => {
    called.push(i); return i === 0 || i === 2 ? 'subject-failed' : true;
  });
  assert.deepEqual(called.sort(), [0, 1, 2, 3]);
  assert.deepEqual(result, { paused: false, dispatched: 4 });
});
test('API preserves subject validation classification without treating configuration or provider errors as local', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'INVALID_LIBRARY_GEOMETRY', message: 'Repair this subject', retryable: false }, { status: 422 }));
  await assert.rejects(requestGenerationJson('/api/generation/svg-icon', {}, new AbortController().signal), error => isSubjectGenerationFailure(error));
  assert.equal(isSubjectGenerationFailure(new GenerationRequestError('wrong colors', 422, 'INVALID_COLOR_PLAN')), false);
  assert.equal(isSubjectGenerationFailure(new GenerationRequestError('provider down', 503, 'SVG_PROVIDER_FAILED')), false);
  assert.equal(isSubjectGenerationFailure(new Error('network')), false);
});

test('provider outage at first item does not dispatch the remaining 39 items', async () => {
  const called: number[] = [];
  const result = await runGenerationBatch(Array.from({ length: 40 }, (_, i) => i), new AbortController().signal, async i => { called.push(i); return false; });
  assert.deepEqual(called, [0]);
  assert.equal(result.paused, true);
});
test('one worker failure stops its sibling from dispatching more work', async () => {
  const called: number[] = [];
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const run = runGenerationBatch([0, 1, 2, 3, 4], new AbortController().signal, async i => {
    called.push(i);
    if (i === 1) return false;
    if (i === 2) await pending;
    return true;
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  release();
  assert.equal((await run).paused, true);
  assert.deepEqual(called, [0, 1, 2]);
});
test('successful batches finish with concurrency bounded to two', async () => {
  let active = 0, peak = 0;
  const result = await runGenerationBatch([0, 1, 2, 3], new AbortController().signal, async () => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--; return true;
  });
  assert.equal(peak, 2);
  assert.deepEqual(result, { paused: false, dispatched: 4 });
});
test('cancellation during probe dispatches no subsequent work', async () => {
  const controller = new AbortController();
  const result = await runGenerationBatch([0, 1, 2], controller.signal, async () => { controller.abort(); return true; });
  assert.equal(result.dispatched, 1);
});
test('provider credential errors are not repeatedly submitted as temporary 502 failures', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ message: 'Invalid provider key', details: { providerStatus: 401 } }, { status: 502 }); };
  try {
    await assert.rejects(requestGenerationJson('/api/generation/svg-icon', {}, new AbortController().signal), /Invalid provider key/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
test('a bounded server generation failure is not multiplied by client retries', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ message: 'Resume later', retryable: false }, { status: 503 }); });
  await assert.rejects(requestGenerationJson('/api/generation/svg-icon', {}, new AbortController().signal), /Resume later/);
  assert.equal(calls, 1);
});

test('manual retry attaches saved plan only for the same set, subject and input; success clears it', async t => {
  const seen: Array<Record<string, unknown>> = [];
  let fail = true;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    seen.push(JSON.parse(String(init?.body)));
    return fail ? Response.json({ message: 'Resume drawing', retryable: false, planCheckpoint: { payload: 'signed plan', signature: 'sig' } }, { status: 503 }) : Response.json({ svg: '<svg/>' });
  });
  const signal = new AbortController().signal, scope = 'project:set:subject';
  const body = { styleId: 'linear', colors: { color: '#343A40' } };
  await assert.rejects(requestGenerationJson('/api/generation/svg-icon', body, signal, scope));
  assert.equal(seen.length, 1);
  fail = false;
  await requestGenerationJson('/api/generation/svg-icon', body, signal, scope + '-other');
  assert.equal(seen.at(-1)?.planCheckpoint, undefined);
  await requestGenerationJson('/api/generation/svg-icon', { colors: body.colors, styleId: 'linear' }, signal, scope);
  assert.ok(seen.at(-1)?.planCheckpoint);
  await requestGenerationJson('/api/generation/svg-icon', body, signal, scope);
  assert.equal(seen.at(-1)?.planCheckpoint, undefined);
  fail = true;
  await assert.rejects(requestGenerationJson('/api/generation/svg-icon', body, signal, scope));
  fail = false;
  await requestGenerationJson('/api/generation/svg-icon', { ...body, styleId: 'bold' }, signal, scope);
  assert.equal(seen.at(-1)?.planCheckpoint, undefined);
});
test('expired or invalid checkpoint is cleared without automatic regeneration', async t => {
  const signal = new AbortController().signal, scope = 'invalid-checkpoint';
  let count = 0;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init?: RequestInit) => {
    count++;
    const input = JSON.parse(String(init?.body));
    if (count === 1) return Response.json({ retryable: false, planCheckpoint: { payload: 'old' } }, { status: 503 });
    if (count === 2) { assert.ok(input.planCheckpoint); return Response.json({ error: 'INVALID_PLAN_CHECKPOINT', retryable: false }, { status: 409 }); }
    assert.equal(input.planCheckpoint, undefined); return Response.json({ svg: '<svg/>' });
  });
  await assert.rejects(requestGenerationJson('/api/generation/svg-icon', {}, signal, scope));
  await assert.rejects(requestGenerationJson('/api/generation/svg-icon', {}, signal, scope));
  assert.equal(count, 2);
  await requestGenerationJson('/api/generation/svg-icon', {}, signal, scope);
});
test('checkpoint cache survives remount reads, expires, and tolerates unavailable browser storage', t => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  t.after(() => { Reflect.deleteProperty(globalThis, 'sessionStorage'); });
  saveGenerationCheckpoint('reload', 'input', { payload: 'saved' });
  assert.ok(storage.size); assert.deepEqual(readGenerationCheckpoint('reload', 'input'), { payload: 'saved' });
  const persisted = [...storage.values()][0];
  saveGenerationCheckpoint('reload', 'input');
  storage.set([...storage.keys()][0], persisted); // Simulate state loaded from a previous document.
  assert.deepEqual(readGenerationCheckpoint('reload', 'input'), { payload: 'saved' });
  assert.equal(readGenerationCheckpoint('reload', 'different'), undefined);
  const now = Date.now(); t.mock.method(Date, 'now', () => now + 25 * 60 * 60 * 1000);
  assert.equal(readGenerationCheckpoint('reload', 'input'), undefined);
  Reflect.deleteProperty(globalThis, 'sessionStorage');
  assert.doesNotThrow(() => saveGenerationCheckpoint('memory-only', 'input', { payload: 'saved' }));
  assert.ok(readGenerationCheckpoint('memory-only', 'input'));
  assert.equal(stableGenerationJson({ b: 2, a: { d: 4, c: 3 } }), stableGenerationJson({ a: { c: 3, d: 4 }, b: 2 }));
});

test('recent real generation skips serial probe; failure restores cold probing', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ svg: '<svg/>' });
  try {
    await requestGenerationJson('/api/generation/svg-icon', {}, new AbortController().signal);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const called: number[] = [];
    const batch = runGenerationBatch([0, 1, 2], new AbortController().signal, async i => { called.push(i); await pending; return false; });
    assert.deepEqual(called, [0, 1]);
    release();
    assert.equal((await batch).paused, true);
    const cold: number[] = [];
    await runGenerationBatch([0, 1, 2], new AbortController().signal, async i => { cold.push(i); return false; });
    assert.deepEqual(cold, [0]);
  } finally { globalThis.fetch = original; }
});
