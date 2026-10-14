import assert from "node:assert/strict";
import test from "node:test";
import { ICON_GENERATION_CATEGORIES } from "./icon-generation-categories";

test("generation offers the library's six direct styles without substyles", () => {
  assert.deepEqual(ICON_GENERATION_CATEGORIES.map(style => style.id),
    ["linear", "outline", "bold", "broken", "bulk", "twotone"]);
  assert.ok(ICON_GENERATION_CATEGORIES.every(style => style.children.length === 1 && style.children[0].id === style.id));
});
