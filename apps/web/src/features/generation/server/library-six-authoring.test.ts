import test from "node:test";
import assert from "node:assert/strict";
import { librarySixDrawingPrompt, parseLibrarySixDesignCard } from "./library-six-authoring";

test("six-style drawing prompt uses V3.2.1 task-card decisions and paired anatomy", () => {
  const prompt = librarySixDrawingPrompt("bold");
  assert.match(prompt, /V3\.2\.1/);
  assert.match(prompt, /recognition \{silhouette,essential,confusableWith,distinguishBy\}/);
  assert.match(prompt, /formPlan \{proportions,contour,attachments,repetition,retained,omitted\}/);
  assert.match(prompt, /MAIN_STYLE_SVG/);
  assert.match(prompt, /transparent negative spaces/);
});

test("six-style design card requires concrete recognition, form and construction sections", () => {
  assert.throws(() => parseLibrarySixDesignCard({ recognition: { silhouette: "gear" } }));
  const card = parseLibrarySixDesignCard({
    recognition: { silhouette: "八齿轮廓", essential: "同心孔洞", confusableWith: "太阳", distinguishBy: "规则齿谷" },
    formPlan: { proportions: "主体居中", contour: "等距八齿", attachments: "无附件，因为主体独立", repetition: "八齿等距", retained: "中心孔", omitted: "无装饰线" },
    styleConstruction: { contourRhythm: "齿顶一致", interiorSpace: "中心透明孔", attachmentTopology: "连续外轮廓", selectedStyle: "直接设计实体和负形", crossStyleInvariants: "八齿和中心孔不变" },
    parts: [{ id: "body", meaning: "齿轮主体" }],
  });
  assert.equal(card.parts[0].id, "body");
});
