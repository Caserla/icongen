import test from "node:test";
import assert from "node:assert/strict";
import { withSvgProviderCapacity } from "./svg-provider-capacity";
test("requests share capacity and release it after success or exceptions", async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const first = withSvgProviderCapacity(async () => { await blocked; return new Response(); });
  const second = withSvgProviderCapacity(async () => { await blocked; return new Response(); });
  let invoked = false;
  const third = await withSvgProviderCapacity(async () => { invoked = true; return new Response(); });
  assert.equal(third.status,429);
  assert.equal(invoked,false);
  release(); await Promise.all([first,second]);
  await assert.rejects(withSvgProviderCapacity(async () => { throw new Error("test"); }));
  assert.equal((await withSvgProviderCapacity(async () => new Response())).status,200);
});
