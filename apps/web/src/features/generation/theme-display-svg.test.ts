import assert from "node:assert/strict";
import test from "node:test";
import { themeDisplaySvg } from "./theme-display-svg";

test("neutral library SVG follows the canvas theme without flattening opacity", () => {
  const svg = '<svg><path stroke="#D6DCE5"/><path fill="#D6DCE5" opacity=".5"/></svg>';
  assert.equal(themeDisplaySvg(svg, "light"), svg.replaceAll("#D6DCE5", "#343a40"));
  assert.equal(themeDisplaySvg(themeDisplaySvg(svg, "light"), "dark").toLowerCase(), svg.toLowerCase());
});

test("manual and multicolor paints remain unchanged", () => {
  const manual = '<svg><path stroke="#2767BE"/></svg>';
  const multi = '<svg><path fill="#D6DCE5"/><path fill="#55AA22"/></svg>';
  assert.equal(themeDisplaySvg(manual, "light"), manual);
  assert.equal(themeDisplaySvg(multi, "light"), multi);
});

test("currentColor-only SVG gets explicit theme ink in an image data URL", () => {
  assert.equal(themeDisplaySvg('<svg stroke="currentColor"/>', "dark"), '<svg stroke="#D6DCE5"/>');
});
