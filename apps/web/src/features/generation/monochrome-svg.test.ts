import assert from "node:assert/strict";
import test from "node:test";
import { applyMonochromeAppearance, isMonochromeStyle, monochromeSvgColor, recolorMonochromeSvg } from "./monochrome-svg";

test("recognizes monochrome substyles and rejects color substyles", () => {
  assert.equal(isMonochromeStyle("regular"), true);
  assert.equal(isMonochromeStyle("pixel-solid"), true);
  assert.equal(isMonochromeStyle("illustrative"), false);
  assert.equal(isMonochromeStyle("two-color"), false);
  assert.equal(isMonochromeStyle("gradient-fill"), false);
});

test("detects one visible SVG paint", () => {
  assert.equal(monochromeSvgColor('<svg><path fill="#ABC"/><path style="stroke:#aabbcc;fill:none"/></svg>'), "#aabbcc");
  assert.equal(monochromeSvgColor('<svg><path fill="#111111"/><path stroke="#222222"/></svg>'), null);
  assert.equal(monochromeSvgColor('<svg><path fill="currentColor"/></svg>'), null);
});

test("recolors only the matching paint and preserves alpha", () => {
  assert.equal(recolorMonochromeSvg('<path fill="#11223380" stroke="#112233"/>', "#112233", "#abcdef"), '<path fill="#abcdef80" stroke="#abcdef"/>');
});

test("applies the same linear and radial appearance controls used by the library", () => {
  const result = applyMonochromeAppearance('<svg viewBox="0 0 24 24"><path fill="#112233"/></svg>', "#112233", { mode: "linear", color: "#ff0000", endColor: "#0000ff", angle: 45 });
  assert.match(result, /linearGradient id="generated-icon-paint"/);
  assert.match(result, /gradientTransform="rotate\(45 \.5 \.5\)"/);
  assert.match(result, /fill="url\(#generated-icon-paint\)"/);
});
