import type { CompileIconPromptInput } from "../types";
import { getConfiguredBackgroundQualityContract } from "../background-contracts";
import { getApprovedStyleReference } from "../style-specs/approved-style-references";
import {
  appIconRequestsNoBackground,
  compileProductionAppIconPrompt,
} from "./production-app-icon-template";

const describeContainer = (
  background: CompileIconPromptInput["background"],
) => {
  if (!background.enabled) return null;
  const color =
    background.color.mode === "solid"
      ? background.color.color
      : `${background.color.colors.join(" 到 ")} 的${background.color.direction}渐变`;
  const shape =
    background.container === "rounded-square"
      ? "rounded 圆角方形"
      : background.container === "circle"
        ? "circular 圆形"
        : "square 方形";
  return { color, shape };
};

export function compileFlatPlayfulAppIconPrompt(
  input: CompileIconPromptInput,
  direction: string,
) {
  const approvedReference = getApprovedStyleReference("flat-playful");
  const noBackground = appIconRequestsNoBackground(input);
  const configuredContainer = describeContainer(input.background);
  const qualityContract = getConfiguredBackgroundQualityContract(
    "flat-playful",
    input.background,
    input.slot,
  );
  const backgroundDescription =
    qualityContract?.mode === "gradient"
      ? `从 ${qualityContract.colors[0]} 到 ${qualityContract.colors[1]}、方向为 ${input.background.enabled && input.background.color.mode === "gradient" ? input.background.color.direction : "top-left-to-bottom-right"} 的平滑渐变背景`
      : `固定为 ${qualityContract?.mode === "solid" ? qualityContract.color : (configuredContainer?.color ?? "#FFD85A")} 的均匀哑光纯色背景`;
  const container = noBackground
    ? null
    : {
        shape: configuredContainer?.shape ?? "rounded 圆角方形",
        color: backgroundDescription,
      };
  const backgroundValue =
    qualityContract?.mode === "gradient"
      ? `${qualityContract.colors[0]} 到 ${qualityContract.colors[1]} 的连续渐变`
      : qualityContract?.mode === "solid"
        ? qualityContract.color
        : "#FFD85A";
  const shapeDelivery = input.background.enabled
    ? input.background.container === "circle"
      ? "不要在图像内容中绘制圆形边界，圆形透明遮罩由交付流程生成"
      : input.background.container === "square"
        ? "保持完整方形画布，交付流程不裁切四角"
        : `不要在图像内容中绘制圆角，约 ${input.background.cornerRadius ?? 22}% 的圆角透明遮罩由交付流程生成`
    : "";
  const subject = `${input.name}：${input.description}`;
  const commonStyle =
    "整体画风固定为高饱和、可爱卡通、圆润扁平化和活泼游戏化学习 App 图标语言，呈现友好、鲜明、圆润、高辨识度气质，但保持原创，不复制任何品牌角色或专有资产。使用厚实圆润的简单几何、2–4 种醒目的大块均匀纯色、简洁可爱比例和易读表情。默认加入克制结构立体感，只通过前后遮挡、同色系深色侧面和独立分层色块表现，保持 80%–90% 平面感。禁止低饱和灰暗商务风、大面积渐变、光泽塑料感、镜面高光、动漫大眼渲染、写实纹理、投影、外发光和写实 3D 光照。";
  const edgeQuality =
    "外轮廓保持单一、闭合、连续和平滑，大色块边界清晰明确，边缘使用自然抗锯齿过渡，不产生断裂、毛刺、残留色块或无意义孤立元素。关键结构缩小到 48 px 时仍清楚可辨。";
  const composition = container
    ? `画面唯一可见内容为一个完整的${subject}和一个${container.color}。背景严格使用 ${backgroundValue}，铺满整张方形母版并一直延伸到四边；纯色必须处处保持相同 RGB 值，渐变必须按指定方向连续、平滑且均匀。背景不承担装饰作用，不形成独立圆形、色斑、雾气、光斑或第二层色块。${shapeDelivery}。所有结构立体感只作用于主体，主题完整居中放置，并与最终形状安全区保持均匀内边距。`
    : `画面唯一可见内容为一个完整的${subject}。主体完整收纳在画布中央安全区域内，占画布宽高的 72%–82%；主体最外缘与画布四边分别保留 9%–14% 的透明安全距离，四侧留白视觉均衡，不贴边、不触边且不被裁切。`;
  const boundary = container
    ? `所有可见像素都属于主题主体、最多一个语义必要的辅助符号或铺满母版的指定背景；背景必须严格遵守所选纯色或渐变，不得出现雾化、喷绘、水彩晕染、非指定渐变、暗角、光晕、噪点、笔刷纹理、独立圆形面板、额外色块、白边、浅色边、描边、外圈或第二层框。`
    : "所有可见像素都属于主题主体或最多一个语义必要的辅助符号；透明安全距离内不放置任何可见内容。";
  return compileProductionAppIconPrompt(input, direction, {
    approvedReferenceProfile:
      approvedReference?.visualSignature ??
      "Approved flat-playful icon-library reference profile.",
    styleFingerprint: commonStyle,
    composition,
    colorAndMaterial:
      "严格使用上述高饱和纯色色块与克制结构层次；不得加入其他风格预设的材质、光照或特效。",
    edgeAndSmallSizeQuality: edgeQuality,
    productionBoundary: boundary,
  });
}
