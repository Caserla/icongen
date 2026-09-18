import { strict as assert } from "node:assert";
import { test } from "node:test";
import { SVG_DESIGN_PLAN_PROMPT, parseSvgDesignPlan } from "./svg-design-plan";

test("pre-generation plan requires structural and cleanliness decisions", () => {
  const plan = parseSvgDesignPlan({
    preservedIntent: "潜水探索功能图标",
    representation: "使用一个潜水面罩与连接的呼吸管，不画完整潜水员场景",
    recognitionTest: "单色 24px 剪影仍可识别为潜水面罩",
    gridPlan: "24 单位网格，四周保留约 2 单位安全区，主体光学居中",
    lineSystem: "所有可见线条统一使用 1.75 视觉线宽与圆端圆角连接",
    cornerSystem: "主体只使用两档一致圆角并保持切线连续",
    complexityBudget: "一个主轮廓，加面窗和呼吸管两组识别结构",
    referenceProfile: {
      opticalWeight: "中等且均匀的视觉重量",
      capJoinLanguage: "统一圆端与圆角连接",
      cornerLanguage: "两档柔和圆角",
      spacingRhythm: "24 单位网格内保持均匀留白",
      detailDensity: "低密度，仅保留识别结构",
      silhouetteTreatment: "一个连贯完整的主剪影",
      colorTreatment: "单一锁定颜色",
    },
    mainContour: "完整潜水面罩作为统一主体",
    identityParts: ["面罩", "连接的呼吸管"],
    connections: ["呼吸管连接面罩右侧"],
    alignment: "共享垂直中心轴",
    contourQuality: "连续规则曲线",
    strokePolicy: "统一 1.5 描边",
    styleApplication: "仅应用当前子风格",
    forbidden: ["悬浮拼块", "混合线宽"],
  });
  assert.equal(plan.identityParts.length, 2);
  assert.match(SVG_DESIGN_PLAN_PROMPT, /before any SVG path is drawn/);
  assert.match(SVG_DESIGN_PLAN_PROMPT, /Preserve the supplied user intent exactly/);
  assert.match(SVG_DESIGN_PLAN_PROMPT, /simplest conventional UI pictogram/);
  assert.match(SVG_DESIGN_PLAN_PROMPT, /assortment of rectangles/);
  assert.match(SVG_DESIGN_PLAN_PROMPT, /exactly one optical stroke width/);
  assert.match(SVG_DESIGN_PLAN_PROMPT, /mandatory visual evidence extracted from that board/);
});
