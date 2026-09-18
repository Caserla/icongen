export type CanvasPosition = { x: number; y: number };
export type CanvasBounds = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export function alignMovingGroup({ proposed, current, moving, others, canvas, scale, threshold = 5 }: {
  proposed: CanvasPosition;
  current: CanvasPosition;
  moving: CanvasBounds;
  others: CanvasBounds[];
  canvas: Pick<CanvasBounds, "left" | "top">;
  scale: number;
  threshold?: number;
}) {
  const deltaX = (proposed.x - current.x) * scale;
  const deltaY = (proposed.y - current.y) * scale;
  const movingX = [moving.left + deltaX, moving.left + moving.width / 2 + deltaX, moving.right + deltaX];
  const movingY = [moving.top + deltaY, moving.top + moving.height / 2 + deltaY, moving.bottom + deltaY];
  let snapXOffset: number | undefined;
  let snapYOffset: number | undefined;
  let snapXGuide: number | undefined;
  let snapYGuide: number | undefined;
  for (const rect of others) {
    const targetsX = [rect.left, rect.left + rect.width / 2, rect.right];
    const targetsY = [rect.top, rect.top + rect.height / 2, rect.bottom];
    for (const value of movingX) for (const target of targetsX) {
      const offset = target - value;
      if (Math.abs(offset) <= threshold && (snapXOffset === undefined || Math.abs(offset) < Math.abs(snapXOffset))) {
        snapXOffset = offset;
        snapXGuide = target - canvas.left;
      }
    }
    for (const value of movingY) for (const target of targetsY) {
      const offset = target - value;
      if (Math.abs(offset) <= threshold && (snapYOffset === undefined || Math.abs(offset) < Math.abs(snapYOffset))) {
        snapYOffset = offset;
        snapYGuide = target - canvas.top;
      }
    }
  }
  return {
    position: { x: proposed.x + (snapXOffset ?? 0) / scale, y: proposed.y + (snapYOffset ?? 0) / scale },
    guides: { x: snapXGuide, y: snapYGuide },
  };
}
