import assert from "node:assert/strict";
import test from "node:test";
import { createIconGenerationLimiter } from "./icon-generation-limiter";

test("limits concurrent icon jobs across batches and starts queued work", async () => {
  const withSlot = createIconGenerationLimiter(2);
  const controller = new AbortController();
  let active = 0;
  let peak = 0;
  const releases: Array<() => void> = [];
  const tasks = Array.from({ length: 5 }, (_, id) => withSlot(controller.signal, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.push(resolve));
    active -= 1;
    return id;
  }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases.length, 2);
  releases.shift()?.();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases.length, 2);
  while (releases.length) {
    releases.shift()?.();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(await Promise.all(tasks), [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
});

test("aborted queued jobs never consume a slot", async () => {
  const withSlot = createIconGenerationLimiter(1);
  const first = new AbortController();
  const queued = new AbortController();
  let releaseFirst: () => void = () => {};
  const running = withSlot(first.signal, () => new Promise<void>(resolve => { releaseFirst = resolve; }));
  const cancelled = withSlot(queued.signal, async () => { throw new Error("queued task ran"); });
  queued.abort(new Error("cancelled"));
  await assert.rejects(cancelled, /cancelled/);
  releaseFirst();
  await running;
});
