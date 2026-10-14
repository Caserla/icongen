"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanResult } from "./icon-plan-results";
import css from "./favorite-icon-groups-dialog.module.css";
import { ProjectCollectionDialog } from "./project-collection-dialog";
import { generationSubjectLabel } from "../generation-subject-label";

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function FavoriteIconGroupsDialog({ open, projectId, projectGroups, zh, onClose, onLocate, onLocateIcon, onExport, onExportIcon, onRemove, onRemoveIcon, onRemoveMany }: { open: boolean; projectId?: string; projectGroups: PlanResult[]; zh: boolean; onClose: () => void; onLocate: (id: string) => void; onLocateIcon: (groupId: string, subjectId: string) => void; onExport: (id: string) => void; onExportIcon: (groupId: string, subjectId: string) => void; onRemove: (id: string) => Promise<void>; onRemoveIcon: (groupId: string, subjectId: string) => Promise<void>; onRemoveMany: (targets: Array<{ groupId: string; subjectId?: string }>) => Promise<void> }) {
  const [category, setCategory] = useState<"groups" | "icons">("groups");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const groups = projectGroups.filter(group => group.favorite && group.plan.subjects.filter(subject => !(group.recycledIconIds ?? []).includes(subject.id)).length > 1);
  const favoriteIcons = projectGroups.flatMap(group => (group.favoriteIconIds ?? []).flatMap(subjectId => {
    const svg = group.icons?.[subjectId];
    const subject = group.plan.subjects.find(item => item.id === subjectId);
    const name = subject ? generationSubjectLabel(subject, group.snapshot as { styleId?: string; secondaryStyleId?: string }, zh) : undefined;
    return svg && subject && name ? [{ groupId: group.id, subjectId, svg, name }] : [];
  }));
  const keys = useMemo(() => category === "groups" ? groups.map(group => group.id) : favoriteIcons.map(icon => `${icon.groupId}:${icon.subjectId}`), [category, groups, favoriteIcons]);
  useEffect(() => { setSelected(current => new Set([...current].filter(key => keys.includes(key)))); }, [keys.join("|")]);
  useEffect(() => { if (!open) { setSelected(new Set()); setBatchBusy(false); } }, [open]);
  const changeCategory = (next: "groups" | "icons") => { setSelected(new Set()); setCategory(next); };
  const toggleSelected = (key: string) => setSelected(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const handleCardClick = (event: React.MouseEvent<HTMLElement>, key: string) => {
    if ((event.target as Element).closest("button")) return;
    toggleSelected(key);
  };
  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>, key: string) => {
    if ((event.target as Element).closest("button")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleSelected(key);
  };
  const downloadSelected = () => {
    if (!selected.size || batchBusy || !projectId) return;
    setBatchBusy(true);
    try {
      const query = new URLSearchParams();
      if (category === "groups") groups.filter(group => selected.has(group.id)).forEach(group => query.append("group", group.id));
      else favoriteIcons.filter(icon => selected.has(`${icon.groupId}:${icon.subjectId}`)).forEach(icon => query.append("icon", `${icon.groupId}:${icon.subjectId}`));
      const anchor = document.createElement("a");
      anchor.href = `/api/projects/${projectId}/favorite-download?${query}`;
      anchor.download = "";
      document.body.append(anchor); anchor.click(); anchor.remove();
    } finally { window.setTimeout(() => setBatchBusy(false), 400); }
  };
  const removeSelected = async () => {
    if (!selected.size || batchBusy) return;
    setBatchBusy(true);
    const targets = [...selected];
    setSelected(new Set());
    try {
      if (category === "groups") await onRemoveMany(targets.map(groupId => ({ groupId })));
      else await onRemoveMany(targets.map(key => {
        const split = key.indexOf(":");
        return { groupId: key.slice(0, split), subjectId: key.slice(split + 1) };
      }));
    } catch { /* Parent restores state and displays the failure toast. */ }
    finally { setBatchBusy(false); }
  };
  const batchBar = keys.length ? <div className={css.batchBar}>
    <label className={css.selectAll}><input type="checkbox" checked={selected.size === keys.length} ref={input => { if (input) input.indeterminate = selected.size > 0 && selected.size < keys.length; }} onChange={() => setSelected(selected.size === keys.length ? new Set() : new Set(keys))} /><span>{zh ? "全选" : "Select all"}</span></label>
    <span className={css.selectedCount}>{zh ? `已选 ${selected.size} 项` : `${selected.size} selected`}</span>
    <div className={css.batchActions}><button type="button" disabled={!selected.size || batchBusy || !projectId} onClick={downloadSelected}>{zh ? "下载所选" : "Download"}</button><button type="button" className={css.batchRemove} disabled={!selected.size || batchBusy} onClick={() => void removeSelected()}>{zh ? "取消收藏" : "Remove favorites"}</button></div>
  </div> : null;
  return <ProjectCollectionDialog open={open} title={zh ? "收藏夹" : "Favorites"} closeLabel={zh ? "关闭收藏夹" : "Close favorites"} tabsLabel={zh ? "收藏分类" : "Favorite categories"} categories={{ groups: zh ? "图组收藏" : "Group favorites", icons: zh ? "单图收藏" : "Single-icon favorites" }} category={category} onCategoryChange={changeCategory} onClose={onClose}>
    {category === "groups" && (groups.length ? <div className={css.grid}>{groups.map(group => {
      const icons = Object.entries(group.icons ?? {}).slice(0, 6);
      return <article className={css.card} role="checkbox" tabIndex={0} aria-checked={selected.has(group.id)} aria-label={zh ? `选择图标组：${group.plan.summary}` : `Select icon group: ${group.plan.summary}`} data-selected={selected.has(group.id) || undefined} onClick={event => handleCardClick(event, group.id)} onKeyDown={event => handleCardKeyDown(event, group.id)} key={group.id}>
        <span className={css.itemSelect} data-checked={selected.has(group.id) || undefined} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.5 3.5 7.5-8" /></svg></span>
        <div className={css.preview}>{icons.length ? <>{icons.map(([id, svg]) => <span key={id}><img src={svgUrl(svg)} alt="" /></span>)}{Array.from({ length: Math.max(0, 6 - icons.length) }, (_, index) => <span className={css.previewEmpty} aria-hidden="true" key={`empty-${index}`} />)}</> : Array.from({ length: 6 }, (_, index) => <span className={css.placeholder} key={index} />)}</div>
        <div className={css.meta}><strong title={group.plan.summary}>{group.plan.summary}</strong><span>{zh ? `${group.plan.count} 个图标` : `${group.plan.count} icons`}</span></div>
        <footer className={css.actions}>
          <button type="button" className={css.groupIconAction} data-tooltip={zh ? "定位画布" : "Locate on canvas"} aria-label={zh ? "定位画布" : "Locate on canvas"} onClick={() => onLocate(group.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="2.5"/></svg></button>
          <button type="button" className={css.groupIconAction} data-tooltip={zh ? "下载" : "Download"} aria-label={zh ? "下载" : "Download"} onClick={() => onExport(group.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m-4-4 4 4 4-4M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/></svg></button>
          <button type="button" className={css.remove} aria-label={zh ? "取消收藏" : "Remove favorite"} onClick={() => onRemove(group.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /><path className={css.unfavoriteSlash} d="M19.5 4.5 4.5 19.5" /></svg></button>
        </footer>
      </article>;
    })}</div> : <div className={css.empty}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg><p>{zh ? "暂无收藏图标组" : "No favorite icon groups yet"}</p></div>)}
    {category === "icons" && (favoriteIcons.length ? <div className={`${css.grid} ${css.libraryGrid}`}>{favoriteIcons.map(icon => { const key = `${icon.groupId}:${icon.subjectId}`; return <article className={css.card} role="checkbox" tabIndex={0} aria-checked={selected.has(key)} aria-label={zh ? `选择 ${icon.name}` : `Select ${icon.name}`} data-selected={selected.has(key) || undefined} onClick={event => handleCardClick(event, key)} onKeyDown={event => handleCardKeyDown(event, key)} key={key}>
        <span className={css.itemSelect} data-checked={selected.has(key) || undefined} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.5 3.5 7.5-8" /></svg></span>
        <div className={css.libraryCard}>
          <img src={svgUrl(icon.svg)} alt="" />
          <strong>{icon.name}</strong>
        </div>
        <div className={css.iconItemActions}>
          <button type="button" className={css.iconItemAction} data-tooltip={zh ? "定位画布" : "Locate on canvas"} aria-label={zh ? `定位 ${icon.name}` : `Locate ${icon.name}`} onClick={() => onLocateIcon(icon.groupId, icon.subjectId)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="2.5"/></svg></button>
          <button type="button" className={css.iconItemAction} data-tooltip={zh ? "下载单图" : "Download icon"} aria-label={zh ? `下载 ${icon.name}` : `Download ${icon.name}`} onClick={() => onExportIcon(icon.groupId, icon.subjectId)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m-4-4 4 4 4-4M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/></svg></button>
        </div>
        <button type="button" className={`${css.iconItemAction} ${css.iconFavoriteRemove}`} data-tooltip={zh ? "取消收藏" : "Remove favorite"} aria-label={zh ? `取消收藏 ${icon.name}` : `Remove ${icon.name} from favorites`} onClick={() => void onRemoveIcon(icon.groupId, icon.subjectId)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /><path className={css.unfavoriteSlash} d="M19.5 4.5 4.5 19.5" /></svg></button>
      </article>; })}</div> : <div className={css.empty}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg><p>{zh ? "暂无收藏单图" : "No favorite single icons yet"}</p></div>)}
    {batchBar}
  </ProjectCollectionDialog>;
}
