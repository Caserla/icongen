import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { previewSvgColors } from "./preview-svg-colors";
import { previewPaletteFor } from "./preview-svg-palette";

test("bundled preview palettes match their SVG artwork", () => {
  for (const dir of ["style-categories", "style-subcategories"]) {
    const root = resolve("public/generation", dir);
    for (const file of readdirSync(root).filter(name => name.endsWith(".svg"))) {
      const svg = readFileSync(resolve(root, file), "utf8");
      const src = `/generation/${dir}/${file}`;
      assert.deepEqual(previewPaletteFor(src, false), previewSvgColors(svg, false), `${src} light`);
      assert.deepEqual(previewPaletteFor(src, true), previewSvgColors(svg, true), `${src} dark`);
    }
  }
});
