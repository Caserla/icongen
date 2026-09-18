export function pendingGenerationId(setId: string) {
  return `${setId}:pending`;
}

export function updateActiveGenerationSets(current: Set<string>, id: string, busy: boolean) {
  const next = new Set(current);
  if (busy) {
    next.add(id);
    const batchIndex = id.indexOf(":batch:");
    if (batchIndex !== -1) next.delete(pendingGenerationId(id.slice(0, batchIndex)));
  } else {
    next.delete(id);
  }
  return next;
}
