import type { CompileIconPromptInput } from "./types";

export type IconGeometryContract = {
  category: "symmetric-symbol" | "circular-structure" | "directional-symbol" | "architectural-outline" | "compound-control" | "general";
  symmetry: "vertical" | "none";
  maxSymmetryError: number;
  prompt: string;
};

export function getIconGeometryContract(
  input: Pick<CompileIconPromptInput, "name" | "description">,
): IconGeometryContract {
  const subject = `${input.name} ${input.description}`.toLowerCase();
  if (/收藏|星|爱心|心形|盾牌|铃铛|star|favorite|heart|shield|bell/.test(subject))
    return {
      category: "symmetric-symbol",
      symmetry: "vertical",
      maxSymmetryError: 0.2,
      prompt: "Use a canonical vertically symmetric construction. Preserve the correct topology, an even distribution of lobes or points, balanced inward notches, and a smooth closed contour. Do not skew, stretch, twist, collapse, or use asymmetry to create a variant.",
    };
  if (/首页|房子|住宅|建筑|home|house|building/.test(subject))
    return {
      category: "architectural-outline",
      symmetry: "vertical",
      maxSymmetryError: 0.24,
      prompt: "Keep the architectural silhouette upright and optically stable, with a level base, balanced roof, aligned openings, and no leaning or warped walls.",
    };
  if (/搜索|时钟|刷新|定位|圆|search|clock|refresh|location|circle/.test(subject))
    return {
      category: "circular-structure",
      symmetry: "none",
      maxSymmetryError: 1,
      prompt: "Keep every intended circular or concentric part geometrically round, smooth, and stable. Do not turn circles into uneven ovals or introduce dents, flat spots, or broken curvature.",
    };
  if (/返回|前进|上传|下载|箭头|back|forward|upload|download|arrow/.test(subject))
    return {
      category: "directional-symbol",
      symmetry: "none",
      maxSymmetryError: 1,
      prompt: "Preserve one unambiguous direction, balanced arrow limbs, a stable centerline, and clean joins. Do not bend, fork, or distort the directional skeleton.",
    };
  if (/设置|调节|筛选|菜单|齿轮|滑杆|settings|adjust|filter|menu|gear|sliders/.test(subject))
    return {
      category: "compound-control",
      symmetry: "none",
      maxSymmetryError: 1,
      prompt: "Keep all component parts aligned to a shared grid with regular spacing and consistent construction. Do not fuse, overlap, detach, or misalign essential parts.",
    };
  return {
    category: "general",
    symmetry: "none",
    maxSymmetryError: 1,
    prompt: "Use a stable, complete, closed semantic skeleton with smooth intentional curves and clean joins. Do not skew, stretch, twist, collapse, self-intersect, or deform the recognizable subject.",
  };
}
