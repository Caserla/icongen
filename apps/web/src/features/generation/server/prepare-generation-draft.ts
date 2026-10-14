import type { IconPlan } from "../icon-plan";
import { expandStatePairPlan, expandStylePairPlan } from "../icon-plan";
import { resolveGenerationBrief, type IntentResolution } from "../generation-intent";
import { generationSnapshotSchema } from "../generation-snapshot";
import { uniformSmartBatchColors } from "./smart-project-colors";
import { readSmartColorPlan } from "./smart-color-plan";
import { isLibraryGenerationStyle } from "../library-generation-styles";

/** Resolves a prepared draft locally. Confirming a conflict never calls the planner again. */
export function prepareGenerationDraft(plan: IconPlan, value: unknown, resolution?: IntentResolution) {
  const snapshot = generationSnapshotSchema.parse(value);
  if (snapshot.designBrief) {
    snapshot.designBrief = resolveGenerationBrief(snapshot.designBrief, resolution);
    snapshot.styleId = snapshot.designBrief.resolvedStyleId;
    const names = new Set(plan.subjects.map(subject => subject.name));
    snapshot.designBrief.colorIntent.partColors = snapshot.designBrief.colorIntent.partColors.filter(part => names.has(part.subjectName));
    const colorInput = snapshot.colors as { mode?: string; default?: { mode?: string; color?: string } } | undefined;
    const requestedColor = snapshot.designBrief.colorIntent.foreground;
    if (colorInput?.mode === "manual" && requestedColor && (colorInput.default?.mode !== "solid" || colorInput.default?.color?.toUpperCase() !== requestedColor)) {
      throw new Error("描述指定的颜色与手动配色不同，请修改描述或调整手动配色后再生成。");
    }
  }
  if (snapshot.secondaryStyleId && snapshot.secondaryStyleId === snapshot.styleId) throw new Error("主风格和次风格不能相同。");
  if (snapshot.styleFamily && (!isLibraryGenerationStyle(snapshot.styleId) || snapshot.secondaryStyleId)) throw new Error("六风格生成只支持素材库六种风格，且每个主体只占一个图标项。");
  snapshot.colors = uniformSmartBatchColors(snapshot.colors, snapshot.styleId, snapshot.theme, snapshot.designBrief?.colorIntent, snapshot.targetSurface);
  const colorPlan = readSmartColorPlan(snapshot.colors);
  if (colorPlan?.grammar === "neutral-one-paint" && colorPlan.partColors.some(part => part.source === "explicit" && part.color !== colorPlan.variants[colorPlan.theme].roles.ink)) {
    throw new Error("当前单色风格需要整批统一前景色，描述中的局部指定色不同；请统一颜色或选择多色风格。");
  }
  if (snapshot.styleId === "state-pair" && !plan.subjects.some(subject => subject.state) && plan.subjects.length > 20) throw new Error("状态配对一次最多支持 20 个主体（40 张图标），请减少数量后重试。");
  if (snapshot.secondaryStyleId && !plan.subjects.some(subject => subject.styleRole) && plan.subjects.length > 20) throw new Error("双风格一次最多支持 20 个主体（40 张图标），请减少数量后重试。");
  const resolvedPlan = snapshot.secondaryStyleId ? expandStylePairPlan(plan)
    : snapshot.styleId === "state-pair" && !plan.subjects.some(subject => subject.state) ? expandStatePairPlan(plan) : plan;
  return { plan: resolvedPlan, snapshot };
}
