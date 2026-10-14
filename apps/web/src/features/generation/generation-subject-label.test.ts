import assert from "node:assert/strict";
import test from "node:test";
import { generationSubjectLabel } from "./generation-subject-label";
import type { IconPlan } from "./icon-plan";

const subject = { id: "camera-main", name: "相机", description: "相机", styleRole: "main" } as IconPlan["subjects"][number];

test("names main and secondary icons by their actual style in both locales", () => {
  const snapshot = { styleId: "linear", secondaryStyleId: "bold" };
  assert.equal(generationSubjectLabel(subject, snapshot, true), "相机 · 线性");
  assert.equal(generationSubjectLabel({ ...subject, styleRole: "secondary" }, snapshot, true), "相机 · 实心");
  assert.equal(generationSubjectLabel({ ...subject, styleRole: "secondary" }, snapshot, false), "相机 · Bold");
});
