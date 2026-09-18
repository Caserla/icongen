import assert from "node:assert/strict";
import { test } from "node:test";
import { previewSvgColors } from "./preview-svg-colors";

test("reads the visible solid paint, not unused gradient definitions", () => {
  const svg = '<svg><style>:root{--ink:#505464}@media(prefers-color-scheme:dark){:root{--ink:#c5c7ce}}</style><defs><linearGradient id="unused"><stop stop-color="#598dea"/><stop stop-color="#be4fd7"/></linearGradient></defs><path fill="none" stroke="var(--ink)"/></svg>';
  assert.deepEqual(previewSvgColors(svg), { solid: "#505464" });
  assert.deepEqual(previewSvgColors(svg, true), { solid: "#C5C7CE" });
});

test("reads the gradient actually applied to artwork", () => {
  const svg = '<svg><defs><linearGradient id="unused"><stop stop-color="#111111"/><stop stop-color="#222222"/></linearGradient><radialGradient id="radial"><stop stop-color="#f5c7ec"/><stop offset="1" stop-color="#6f4de6"/></radialGradient></defs><path fill="url(#radial)" stroke="none"/><path fill="none" stroke="#fff"/></svg>';
  assert.deepEqual(previewSvgColors(svg), { solid: "#F5C7EC", gradient: { start: "#F5C7EC", end: "#6F4DE6", mode: "radial" } });
});

test("preserves opacity from translucent SVG paint", () => {
  assert.deepEqual(previewSvgColors('<svg><path fill="#ffffff88"/></svg>'), { solid: "#FFFFFF", alpha: 53 });
});
