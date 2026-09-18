import assert from "node:assert/strict";
import test from "node:test";
import { ICON_GENERATION_CATEGORIES } from "./icon-generation-categories";

test("exposes the interaction icon atlas as 14 style families and 46 substyles", () => {
  assert.equal(ICON_GENERATION_CATEGORIES.length, 14);
  assert.equal(
    ICON_GENERATION_CATEGORIES.reduce(
      (total, category) => total + category.children.length,
      0,
    ),
    46,
  );
  assert.deepEqual(
    ICON_GENERATION_CATEGORIES[0].children.map((style) => style.id),
    ["thin", "light", "regular", "bold-outline", "broken-outline"],
  );
});
