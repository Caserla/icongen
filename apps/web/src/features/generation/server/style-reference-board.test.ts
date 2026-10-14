import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { generationStyleReference, styleReferenceBoardDataUrl } from "./style-reference-board";

test("loads the 24-icon radial reference board", () => {
  assert.match(styleReferenceBoardDataUrl("radial") ?? "", /^data:image\/png;base64,/);
});

test("legacy atlas has no broken board, but production renders actual library Broken evidence", async () => {
  assert.equal(styleReferenceBoardDataUrl("broken-outline"), null);
  const reference = await generationStyleReference("broken-outline");
  assert.match(reference!.source, /^library-broken:/);
  assert.match(reference!.dataUrl, /^data:image\/png;base64,/);
  assert.equal(reference!.source.split("broken.svg").length - 1, 4);
});

test("uses confirmed versions instead of obsolete atlas boards", async () => {
  assert.match((await generationStyleReference("filled-duotone"))!.source, /normalized-v3\.png$/);
  assert.match((await generationStyleReference("mono-pastel"))!.source, /normalized-v2\.png$/);
});

test("reviewed styles use enlarged four-subject evidence instead of a tiny 24-icon atlas", async () => {
  const sharp = (await import("sharp")).default;
  for (const id of ["isometric", "doodle", "pixel-outline", "pixel-solid", "pixel-color", "outline-duotone"]) {
    const reference = await generationStyleReference(id);
    assert.match(reference!.source, /^focused-4:/);
    const metadata = await sharp(Buffer.from(reference!.dataUrl.split(",")[1], "base64")).metadata();
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
  }
});

test("linear, bold, pair and broken receive actual library raster evidence", async () => {
  for (const id of ["regular", "pure-solid", "state-pair", "broken-outline"]) {
    const reference = await generationStyleReference(id);
    assert.match(reference!.source, /^library-/);
    assert.match(reference!.dataUrl, /^data:image\/png;base64,/);
    assert.match(reference!.sha256, /^[a-f0-9]{64}$/);
  }
});

test("all 46 production styles have a decodable reference rather than silent text-only fallback", async () => {
  const { styles } = JSON.parse(readFileSync(new URL("../../../../../../docs/design/svg-style-production-v3.json", import.meta.url), "utf8"));
  const sharp = (await import("sharp")).default;
  for (const id of Object.keys(styles)) {
    const reference = await generationStyleReference(id);
    assert.ok(reference, id);
    const metadata = await sharp(Buffer.from(reference.dataUrl.split(",")[1], "base64")).metadata();
    assert.equal(metadata.format, "png", id);
    assert.ok(metadata.width! > 0 && metadata.height! > 0, id);
  }
});

test("uses the actual 24-icon illustrative atlas rather than the strawberry preview", () => {
  const atlas = readFileSync(new URL("../../../../../../outputs/ui-style-reference-boards-2026-09-15/22-illustrative-atlas-reference-v1.png", import.meta.url));
  assert.equal(styleReferenceBoardDataUrl("illustrative"), `data:image/png;base64,${atlas.toString("base64")}`);
});
