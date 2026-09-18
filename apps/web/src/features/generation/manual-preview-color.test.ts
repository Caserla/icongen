import assert from "node:assert/strict";
import test from "node:test";
import { recolorPreviewSvg } from "./manual-preview-color";

test("recolors the selected solid paint without changing unrelated colors", () => {
  const svg = '<svg><style>:root{--ink:#505464}</style><path fill="#505464" stroke="#ffffff"/></svg>';
  const result = recolorPreviewSvg(svg, { solid: "#505464" }, { src: "solid.svg", solid: "#E43F5E", alpha: 100 });
  assert.match(result, /--ink:#E43F5E/);
  assert.match(result, /fill="#E43F5E"/);
  assert.match(result, /stroke="#ffffff"/);
});

test("recolors matching gradient stops and preserves other gradients", () => {
  const svg = '<svg><defs><linearGradient id="target"><stop stop-color="#598dea"/><stop stop-color="#be4fd7"/></linearGradient><linearGradient id="other"><stop stop-color="#111111"/><stop stop-color="#222222"/></linearGradient></defs></svg>';
  const result = recolorPreviewSvg(svg, { solid: "#598DEA", gradient: { start: "#598DEA", end: "#BE4FD7", mode: "linear" } }, { src: "gradient.svg", solid: "#FF0000", alpha: 100, gradient: { start: "#FF0000", end: "#0000FF", mode: "linear" } });
  assert.match(result, /stop-color="#ff0000".*stop-color="#0000ff"/);
  assert.match(result, /stop-color="#111111".*stop-color="#222222"/);
});

test("applies selected opacity to alpha-bearing solid paint", () => {
  const result = recolorPreviewSvg('<svg><path fill="#a9c2ff66"/></svg>', { solid: "#A9C2FF", alpha: 40 }, { src: "tinted.svg", solid: "#123456", alpha: 50 });
  assert.equal(result, '<svg><path fill="#12345680"/></svg>');
});
