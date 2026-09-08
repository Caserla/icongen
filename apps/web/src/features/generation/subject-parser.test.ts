import assert from "node:assert/strict";
import test from "node:test";
import { parseSubjectRows } from "./subject-parser";

test("parses name and description lines without splitting description punctuation", () => {
  assert.deepEqual(
    parseSubjectRows(["首页：房子，带圆角屋顶", "删除：垃圾桶"]),
    [
      { clientId: "subject-1", name: "首页", description: "房子，带圆角屋顶" },
      { clientId: "subject-2", name: "删除", description: "垃圾桶" },
    ],
  );
});

test("treats each input row as exactly one icon subject", () => {
  const subjects = parseSubjectRows(["查找", "返回", "首页", "删除"]);
  assert.deepEqual(
    subjects.map(({ name }) => name),
    ["查找", "返回", "首页", "删除"],
  );
});

test("keeps a single free-form subject as one icon", () => {
  const subjects = parseSubjectRows(["一个用于切换深色模式的月亮图标"]);
  assert.equal(subjects.length, 1);
  assert.equal(subjects[0]?.description, "一个用于切换深色模式的月亮图标");
});
