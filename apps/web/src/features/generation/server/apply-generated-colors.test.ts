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

test("manual gradient preserves black and white mask geometry", () => {
  const input = '<svg viewBox="0 0 24 24"><defs><mask id="hole"><rect width="24" height="24" fill="white"/><circle cx="12" cy="12" r="5" fill="black"/></mask></defs><circle cx="12" cy="12" r="9" fill="#4488DD" mask="url(#hole)"/></svg>';
  const output = applyLockedGradient(input, { locked: true, default: { mode: "linear", color: "#123456", endColor: "#ABCDEF" } }, "manual");
  assert.match(output, /r="5" fill="black"/);
  assert.match(output, /height="24" fill="white"/);
  assert.match(output, /r="9" fill="url\(#manual-locked-gradient\)"/);
});

test("stroke checks understand inherited group widths and do not flatten material treatment", () => {
  const inherited = '<svg viewBox="0 0 24 24"><g fill="none" stroke="#222" stroke-width="1.5"><circle cx="8" cy="8" r="5"/><path stroke-width="1.5" d="M12 12L20 20"/></g></svg>';
  assert.doesNotThrow(() => assertStyleConformance(inherited, "regular"));
  assert.throws(() => assertStyleConformance(inherited.replace('path stroke-width="1.5"', 'path stroke-width="2"'), "regular"));
  assert.doesNotThrow(() => assertStyleConformance(inherited.replace('path stroke-width="1.5"', 'path stroke-width="0.5"'), "frosted"));
});

test("planned neon bright core can be thinner only on identical existing tube geometry", () => {
  const svg = '<svg viewBox="0 0 24 24"><g fill="none" stroke="#1689C5" stroke-width="1.5"><circle cx="9" cy="9" r="5"/></g><g fill="none" stroke="#90E7FF" stroke-width="0.75" data-emission-layer="core"><circle cx="9" cy="9" r="5"/></g></svg>';
  assert.doesNotThrow(() => assertStyleConformance(svg, "neon-tube"));
  assert.throws(() => assertStyleConformance(svg, "regular"), /Inconsistent stroke widths/);
  assert.throws(() => assertStyleConformance(svg, "dual-neon"), /Inconsistent stroke widths/);
  assert.throws(() => assertStyleConformance(svg.replace('data-emission-layer="core"', ''), "neon-tube"), /Inconsistent stroke widths/);
  assert.throws(() => assertStyleConformance(svg.replace('stroke-width="0.75"', 'stroke-width="1"'), "neon-tube"), /Neon emission core/);
  assert.throws(() => assertStyleConformance(svg.replace('data-emission-layer="core"', 'data-emission-layer="core" transform="translate(1 0)"'), "neon-tube"), /Neon emission core/);
  assert.throws(() => assertStyleConformance(svg.replace('data-emission-layer="core"', 'data-emission-layer="core" filter="url(#blur)"'), "neon-tube"), /Neon emission core/);
  assert.throws(() => assertStyleConformance(svg.replace('r="5"/></g></svg>', 'r="4"/></g></svg>'), "neon-tube"), /Neon emission core/);
});
