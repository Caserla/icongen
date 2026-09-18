import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { styleReferenceBoardDataUrl } from "./style-reference-board";

test("loads the 24-icon radial reference board", () => {
  assert.match(styleReferenceBoardDataUrl("radial") ?? "", /^data:image\/png;base64,/);
});

test("falls back to the substyle SVG when the legacy 24-icon board is absent", () => {
  assert.match(styleReferenceBoardDataUrl("broken-outline") ?? "", /^data:image\/svg\+xml;base64,/);
});

test("uses the actual 24-icon illustrative atlas rather than the strawberry preview", () => {
  const atlas = readFileSync(new URL("../../../../../../outputs/ui-style-reference-boards-2026-09-15/22-illustrative-atlas-reference-v1.png", import.meta.url));
  assert.equal(styleReferenceBoardDataUrl("illustrative"), `data:image/png;base64,${atlas.toString("base64")}`);
});
