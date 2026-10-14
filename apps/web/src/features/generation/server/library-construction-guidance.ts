import protocol from "./library-protocol.generated.json";
import { librarySixStyleContract } from "./library-six-authoring";

/** Route canonical clauses, not a second independently maintained style specification. */
export function libraryConstructionGuidance(styles: string[]) {
  styles.forEach(librarySixStyleContract); // Fail closed for unknown style keys.
  const selected = new Set(styles);
  return protocol.construction.split(/\n\n/).map(block => {
    // Project task-card/entrypoint prose is not this service's JSON output schema.
    if (block.startsWith("正式任务卡增加") || block.startsWith("执行器强制检查")) return "";
    if (block.startsWith("| 样式")) return block.split("\n").filter(line => {
      const style = line.match(/^\| (Linear|Outline|Bold|Broken|Bulk|Twotone) \|/)?.[1]?.toLowerCase();
      return !style || selected.has(style);
    }).join("\n");
    if (block.startsWith("Bold 的外围") && !selected.has("bold")) return "";
    if (block.startsWith("Bulk 的深浅") && !selected.has("bulk") && !selected.has("twotone")) return "";
    // Section 4A is one numbered block; filter style-specific paragraphs within it.
    return block.split("\n").filter(line => {
      if (/^4\. \*\*Bold /.test(line)) return selected.has("bold");
      if (/^5\. \*\*Bulk /.test(line)) return selected.has("bulk");
      return true;
    }).join("\n");
  }).filter(Boolean).join("\n\n");
}

export const libraryConnectionGuidance = `Decide connection visibility BEFORE paths. A fused piece shares one exterior; an articulated joint keeps a visible interface; an occluded part stops behind the front part; separate parts retain clear air. Do not merge all touching parts just because they belong to one object. For every identity-bearing part specify the edge, silhouette protrusion, aperture or intentional tonal boundary that makes it visible in the assembled image. A same-color mark completely inside a same-color mass contributes no visible feature, regardless of its part ID or drawing order. Revise the local construction, not its label. Do not manufacture separation using white coverups or decorative halos. True holes remain transparent. In a line style, route the rear contour around the front part's readable boundary; in a filled style, plan the interface as real negative space or silhouette. Use opacity only where the selected style permits it. Keep essential connections intact.`;

export const libraryCurveConstructionGuidance = `Construct curves from the chosen form, not independently guessed control points. For genuinely regular parts use circle/ellipse, rounded rect or SVG A arcs with shared centers/radii; do not force organic contours into these primitives. For a custom cubic, its start tangent is P1-P0 and its end tangent is P3-P2. At a smooth join these must align with the neighboring line/curve in the forward direction; G1 tangency alone is not enough if the handles create a flat spot, bulge or abrupt curvature change. Allocate a visible turning span instead of a tiny curve hiding a sharp corner. Round caps/joins do not repair an uneven centerline. Closed smooth paths must also meet tangentially at Z. Repeated or truly symmetric rigid parts share dimensions, radii and derived coordinates; do not estimate each copy separately. Natural asymmetry and genuine semantic corners are allowed and must not be rounded away. For Broken, split a chosen arc or subdivide a cubic from the same continuous source geometry, then remove only the planned nonessential interval; do not redraw the remaining contour by eye. Keep the cap-adjusted gap readable. Serialize derived coordinates directly; no SVG transforms are required.`;
