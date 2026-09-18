type ProjectSet = { id: string; saved?: boolean; snapshot: unknown };

export function mergeProjectSvgSetPage<T extends ProjectSet>(current: T[], projectId: string, incoming: T[], firstPage: boolean): T[] {
  const belongsToProject = (item: T) => (item.snapshot as { projectId?: string })?.projectId === projectId;
  const otherProjects = current.filter(item => !belongsToProject(item));
  const existing = current.filter(item => belongsToProject(item) && (!firstPage || !item.saved));
  const merged = new Map(existing.map(item => [item.id, item]));
  incoming.forEach(item => merged.set(item.id, item));
  return [...otherProjects, ...merged.values()];
}
