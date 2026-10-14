import assert from "node:assert/strict";
import { test } from "node:test";
import { LIBRARY_GENERATION_STYLES, libraryStylePreview } from "./library-generation-styles";
import { previewPaletteFor } from "./preview-svg-palette";

test("the six active library previews use a neutral manual ink", () => {
  for (const style of LIBRARY_GENERATION_STYLES) {
    const src = libraryStylePreview(style);
    assert.equal(src, `/library/samples/emoji-sample-1/${style}.svg`);
    assert.deepEqual(previewPaletteFor(src, false), { solid: "#343A40" }, `${src} light`);
    assert.deepEqual(previewPaletteFor(src, true), { solid: "#D6DCE5" }, `${src} dark`);
  }
  assert.equal(previewPaletteFor("/generation/style-categories/3d-clay.svg", false), null);
});
