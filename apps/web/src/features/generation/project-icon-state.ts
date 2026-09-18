import type { PlanResult } from "./components/icon-plan-results";

export function setGroupFavorite(items: PlanResult[], groupId: string, favorite: boolean): PlanResult[] {
  return items.map(item => item.id === groupId ? { ...item, favorite, recycled: favorite ? false : item.recycled } : item);
}

export function setIconFavorite(items: PlanResult[], groupId: string, subjectId: string, favorite: boolean): PlanResult[] {
  return items.map(item => item.id !== groupId ? item : {
    ...item,
    favoriteIconIds: favorite
      ? [...new Set([...(item.favoriteIconIds ?? []), subjectId])]
      : (item.favoriteIconIds ?? []).filter(id => id !== subjectId),
    recycledIconIds: favorite ? (item.recycledIconIds ?? []).filter(id => id !== subjectId) : item.recycledIconIds,
  });
}

export function recycleGroupState(items: PlanResult[], groupId: string, layoutSize?: PlanResult["layoutSize"]): PlanResult[] {
  return items.map(item => item.id === groupId ? { ...item, favorite: false, recycled: true, layoutSize } : item);
}

export function recycleIconState(items: PlanResult[], groupId: string, subjectId: string): PlanResult[] {
  return items.map(item => item.id !== groupId ? item : {
    ...item,
    favoriteIconIds: (item.favoriteIconIds ?? []).filter(id => id !== subjectId),
    recycledIconIds: [...new Set([...(item.recycledIconIds ?? []), subjectId])],
  });
}
