import test from "node:test";
import assert from "node:assert/strict";
import { validateGeneratedSvg } from "./validate-generated-svg";
const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${inner}</svg>`;
test("accepts editable SVG with local gradients", () => {
  const svg = wrap('<defs><linearGradient id="paint"><stop stop-color="#ffffff"/></linearGradient></defs><path d="M2 2L20 20" stroke="url(#paint)"/>');
  assert.equal(validateGeneratedSvg(svg), svg);
});
test("rejects executable, external, malformed and empty SVG", () => {
  for (const svg of [wrap('<script>alert(1)</script>'), wrap('<path onload="alert(1)"/>'), wrap('<image href="https://example.com/a.png"/>'), wrap('<path stroke="url(#missing)"/>'), wrap(''), wrap('<path>')]) assert.throws(() => validateGeneratedSvg(svg));
});
