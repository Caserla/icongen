"use client";

import { useState } from "react";
import type { PlanResult } from "./icon-plan-results";
import css from "./favorite-icon-groups-dialog.module.css";
import { ProjectCollectionDialog } from "./project-collection-dialog";

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function FavoriteIconGroupsDialog({ open, projectGroups, zh, onClose, onLocate, onExport, onRemove, onRemoveIcon }: { open: boolean; projectGroups: PlanResult[]; zh: boolean; onClose: () => void; onLocate: (id: string) => void; onExport: (id: string) => void; onRemove: (id: string) => void; onRemoveIcon: (groupId: string, subjectId: string) => void }) {
  const [category, setCategory] = useState<"groups" | "icons">("groups");
  const groups = projectGroups.filter(group => group.favorite && group.plan.subjects.filter(subject => !(group.recycledIconIds ?? []).includes(subject.id)).length > 1);
  const favoriteIcons = projectGroups.flatMap(group => (group.favoriteIconIds ?? []).flatMap(subjectId => {
    const svg = group.icons?.[subjectId];
    const subject = group.plan.subjects.find(item => item.id === subjectId);
    return svg && subject ? [{ groupId: group.id, subjectId, svg, name: subject.name }] : [];
  }));
  return <ProjectCollectionDialog open={open} title={zh ? "收藏夹" : "Favorites"} closeLabel={zh ? "关闭收藏夹" : "Close favorites"} tabsLabel={zh ? "收藏分类" : "Favorite categories"} categories={{ groups: zh ? "图组收藏" : "Group favorites", icons: zh ? "单图收藏" : "Single-icon favorites" }} category={category} onCategoryChange={setCategory} onClose={onClose}>
    {category === "groups" && (groups.length ? <div className={css.grid}>{groups.map(group => {
      const icons = Object.entries(group.icons ?? {}).slice(0, 6);
      return <article className={css.card} key={group.id}>
        <div className={css.preview}>{icons.length ? icons.map(([id, svg]) => <span key={id}><img src={svgUrl(svg)} alt="" /></span>) : Array.from({ length: Math.min(group.plan.count, 6) }, (_, index) => <span className={css.placeholder} key={index} />)}</div>
        <div className={css.meta}><strong title={group.plan.summary}>{group.plan.summary}</strong><span>{zh ? `${group.plan.count} 个图标` : `${group.plan.count} icons`}</span></div>
        <footer className={css.actions}>
          <button type="button" onClick={() => onLocate(group.id)}>{zh ? "定位画布" : "Locate"}</button>
          <button type="button" onClick={() => onExport(group.id)}>{zh ? "导出" : "Export"}</button>
          <button type="button" className={css.remove} aria-label={zh ? "取消收藏" : "Remove favorite"} onClick={() => onRemove(group.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg></button>
        </footer>
      </article>;
    })}</div> : <div className={css.empty}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg><p>{zh ? "暂无收藏图标组" : "No favorite icon groups yet"}</p></div>)}
    {category === "icons" && (favoriteIcons.length ? <div className={`${css.grid} ${css.libraryGrid}`}>{favoriteIcons.map(icon => <article className={css.card} key={`${icon.groupId}:${icon.subjectId}`}>
        <button type="button" className={css.libraryRemove} data-tooltip={zh ? "取消收藏" : "Remove favorite"} aria-label={zh ? "取消收藏" : "Remove favorite"} onClick={() => onRemoveIcon(icon.groupId, icon.subjectId)}>×</button>
        <button type="button" className={css.libraryCard} onClick={() => onLocate(icon.groupId)}>
          <img src={svgUrl(icon.svg)} alt="" />
          <strong>{icon.name}</strong>
        </button>
      </article>)}</div> : <div className={css.empty}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg><p>{zh ? "暂无收藏单图" : "No favorite single icons yet"}</p></div>)}
  </ProjectCollectionDialog>;
}
