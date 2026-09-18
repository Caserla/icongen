import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyLockedGradient, assertStyleConformance } from "./apply-generated-colors";

test("locked radial color replaces arbitrary paints and preserves white details", () => {
  const input = '<svg viewBox="0 0 24 24"><path fill="#64748B" d="M1 1h10v10z"/><path fill="#fff" d="M4 4h2v2z"/></svg>';
  const output = applyLockedGradient(input, { locked: true, default: { mode: "radial", color: "#2563eb", endColor: "#38bdf8" } }, "test");
  assert.match(output, /<radialGradient id="test-locked-gradient"/);
  assert.match(output, /fill="url\(#test-locked-gradient\)"/);
  assert.match(output, /fill="#fff"/);
  assert.doesNotMatch(output, /#64748B/);
});

test("radial style rejects output without radial gradient", () => {
  assert.throws(() => assertStyleConformance('<svg viewBox="0 0 24 24"><path fill="#000" d="M0 0h1v1z"/></svg>', "radial"));
});

test("mixed visible stroke widths are rejected", () => {
  const svg = '<svg viewBox="0 0 24 24"><path d="M2 2h10" fill="none" stroke="#000" stroke-width="1.5"/><path d="M2 6h10" fill="none" stroke="#000" stroke-width="2"/></svg>';
  assert.throws(() => assertStyleConformance(svg, "regular"), /Inconsistent stroke widths/);
});

test("one consistent stroke width is accepted", () => {
  const svg = '<svg viewBox="0 0 24 24"><path d="M2 2h10" fill="none" stroke="#000" stroke-width="1.5"/><path d="M2 6h10" fill="none" stroke="#000" stroke-width="1.5"/></svg>';
  assert.doesNotThrow(() => assertStyleConformance(svg, "regular"));
});
