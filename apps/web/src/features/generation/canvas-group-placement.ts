type Rect = { left: number; right: number; top: number; bottom: number };

export function placeGeneratedGroup({
  current,
  generated,
  existing,
  scale,
  gap = 24,
}: {
  current: { x: number; y: number };
  generated: Rect;
  existing: Rect[];
  scale: number;
  gap?: number;
}) {
  if (!existing.length || !Number.isFinite(scale) || scale <= 0)
    return current;

  const left = Math.min(...existing.map(rect => rect.left));
  const right = Math.max(...existing.map(rect => rect.right));
  const bottom = Math.max(...existing.map(rect => rect.bottom));
  const targetLeft = (left + right - (generated.right - generated.left)) / 2;
  const targetTop = bottom + gap * scale;

  return {
    x: current.x + (targetLeft - generated.left) / scale,
    y: current.y + (targetTop - generated.top) / scale,
  };
}
