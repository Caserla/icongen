/** Pure helpers for the landing page's scroll-linked timelines. */
export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function clampSigned(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0;
}

export function sectionProgress(
  top: number,
  height: number,
  viewportHeight: number,
  stickyTop = 92,
): number {
  if (
    ![top, height, viewportHeight, stickyTop].every(Number.isFinite) ||
    viewportHeight <= 0
  )
    return 0;
  const travel = Math.max(1, height - Math.max(0, viewportHeight - stickyTop));
  return clampProgress((stickyTop - top) / travel);
}

export function segmentProgress(
  progress: number,
  start: number,
  end: number,
): number {
  if (![progress, start, end].every(Number.isFinite) || end <= start) return 0;
  return clampProgress((progress - start) / (end - start));
}

export function easedProgress(value: number): number {
  const progress = clampProgress(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function centeredViewportOffset(
  top: number,
  height: number,
  viewportHeight: number,
): number {
  if (
    ![top, height, viewportHeight].every(Number.isFinite) ||
    viewportHeight <= 0
  )
    return 0;
  const center = top + Math.max(0, height) / 2;
  return clampSigned(
    (center - viewportHeight / 2) / Math.max(1, viewportHeight),
  );
}

export function normalizePointer(
  position: number,
  start: number,
  size: number,
): number {
  if (![position, start, size].every(Number.isFinite) || size <= 0) return 0;
  return clampSigned(((position - start) / size - 0.5) * 2);
}

export function shouldAnimateArtwork({
  visible,
  pageHidden,
  reducedMotion,
  paused = false,
}: {
  visible: boolean;
  pageHidden: boolean;
  reducedMotion: boolean;
  paused?: boolean;
}): boolean {
  return visible && !pageHidden && !reducedMotion && !paused;
}
