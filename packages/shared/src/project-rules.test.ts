import assert from "node:assert/strict";
import test from "node:test";
import {
  iconProjectDescriptionSchema,
  iconProjectNameSchema,
  MAX_ICON_PROJECTS,
} from "./generation-v2";

test("allows at most twenty projects per account", () => {
  assert.equal(MAX_ICON_PROJECTS, 20);
});

test("project descriptions use language-aware limits", () => {
  assert.equal(iconProjectDescriptionSchema.safeParse("项目简介").success, true);
  assert.equal(iconProjectDescriptionSchema.safeParse("中".repeat(300)).success, true);
  assert.equal(iconProjectDescriptionSchema.safeParse("中".repeat(301)).success, false);
  assert.equal(iconProjectDescriptionSchema.safeParse(Array.from({ length: 400 }, () => "word").join(" ")).success, true);
  assert.equal(iconProjectDescriptionSchema.safeParse(Array.from({ length: 401 }, () => "word").join(" ")).success, false);
});

test("validates Chinese and English project-name limits", () => {
  assert.equal(iconProjectNameSchema.safeParse("一二三四五六七八九十一二三四五六七八").success, true);
  assert.equal(iconProjectNameSchema.safeParse("一二三四五六七八九十一二三四五六七八九").success, false);
  assert.equal(iconProjectNameSchema.safeParse(Array.from({ length: 20 }, (_, index) => `word${index}`).join(" ")).success, true);
  assert.equal(iconProjectNameSchema.safeParse(Array.from({ length: 21 }, (_, index) => `word${index}`).join(" ")).success, false);
});
