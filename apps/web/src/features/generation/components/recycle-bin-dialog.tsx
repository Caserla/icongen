"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import css from "./favorite-icon-groups-dialog.module.css";
import { ProjectCollectionDialog } from "./project-collection-dialog";

type RecycledGroup = { id: string; plan: { summary?: string; count?: number }; icons: Record<string, string> };
type RecycledIcon = { groupId: string; subjectId: string; name: string; svg: string };
type DeleteTarget = { groupId: string; subjectId?: string; label: string };
type RestoreTarget = DeleteTarget & { svg?: string; icons?: Record<string, string> };
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function PermanentDeleteDialog({ targets, zh, onClose, onConfirm }: { targets: DeleteTarget[]; zh: boolean; onClose: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const targetLabel = targets.length === 1 ? `“${targets[0].label}”` : (zh ? `选中的 ${targets.length} 项内容` : `${targets.length} selected items`);
  return <dialog
    ref={dialogRef}
    className={css.confirmDialog}
    data-canvas-controls
    aria-labelledby="permanent-delete-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}
  >
    <button type="button" className={css.confirmClose} aria-label={zh ? "关闭确认弹窗" : "Close confirmation"} onClick={onClose}>×</button>
    <div className={`${css.confirmMark} ${css.confirmMarkWarning}`} aria-hidden="true">!</div>
    <h2 id="permanent-delete-title">{zh ? "确认永久删除？" : "Delete permanently?"}</h2>
    <p>{zh ? `${targetLabel}永久删除后将无法找回。` : `${targetLabel} cannot be recovered after deletion.`}</p>
    <footer className={css.confirmActions}>
      <button type="button" onClick={onClose}>{zh ? "取消" : "Cancel"}</button>
      <button type="button" className={css.confirmDanger} onClick={onConfirm}>{zh ? "永久删除" : "Delete permanently"}</button>
    </footer>
  </dialog>;
}

export function RecycleBinDialog({ open, projectId, zh, onClose, onRestored, onDeleted }: { open: boolean; projectId?: string; zh: boolean; onClose: () => void; onRestored: (restored: { groupId: string; subjectId?: string; svg?: string; icons?: Record<string, string> }) => void; onDeleted: (deleted: { groupId: string; subjectId?: string }) => void }) {
  const [category, setCategory] = useState<"groups" | "icons">("groups");
  const [groups, setGroups] = useState<RecycledGroup[]>([]);
  const [icons, setIcons] = useState<RecycledIcon[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [deletePrompt, setDeletePrompt] = useState<{ targets: DeleteTarget[] } | null>(null);
  const load = useCallback(async () => {
    if (!projectId) { setGroups([]); setIcons([]); return; }
    setLoading(true); setFailed(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/recycle-bin`, { cache: "no-store" });
      if (!response.ok) throw new Error("Recycle bin unavailable");
      const payload = await response.json() as { groups: RecycledGroup[]; icons: RecycledIcon[] };
      setGroups(payload.groups); setIcons(payload.icons);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [open, load]);
  const keys = useMemo(() => category === "groups" ? groups.map(group => group.id) : icons.map(icon => `${icon.groupId}:${icon.subjectId}`), [category, groups, icons]);
  useEffect(() => { setSelected(current => new Set([...current].filter(key => keys.includes(key)))); }, [keys.join("|")]);
  useEffect(() => { if (!open) { setSelected(new Set()); setBatchBusy(false); } }, [open]);
  const changeCategory = (next: "groups" | "icons") => { setSelected(new Set()); setDeletePrompt(null); setCategory(next); };
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
    if ((event.target as Element).closest("button") || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault(); toggleSelected(key);
  };
  const restoreMany = async (targets: RestoreTarget[]) => {
    if (!projectId || !targets.length || batchBusy) return;
    setBatchBusy(true);
    setSelected(new Set());
    onClose();
    try {
      const responses = await Promise.all(targets.map(target => {
        const path = target.subjectId ? `/api/projects/${projectId}/svg-sets/${target.groupId}/icons/${encodeURIComponent(target.subjectId)}` : `/api/projects/${projectId}/svg-sets/${target.groupId}`;
        return fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recycled: false }) });
      }));
      if (responses.some(response => !response.ok)) throw new Error("Restore failed");
      targets.forEach(({ groupId, subjectId, svg, icons: restoredIcons }) => onRestored({ groupId, subjectId, svg, icons: restoredIcons }));
    } catch { setFailed(true); } finally { setBatchBusy(false); }
  };
  const permanentlyDeleteMany = async (targets: DeleteTarget[]) => {
    if (!projectId || !targets.length || batchBusy) return;
    const keysToDelete = targets.map(target => `${target.groupId}:${target.subjectId ?? "group"}`);
    if (keysToDelete.some(key => deleting.has(key))) return;
    const previousGroups = groups;
    const previousIcons = icons;
    setBatchBusy(true);
    setSelected(new Set());
    setDeleting(current => new Set([...current, ...keysToDelete]));
    const groupIds = new Set(targets.filter(target => !target.subjectId).map(target => target.groupId));
    const iconKeys = new Set(targets.filter(target => target.subjectId).map(target => `${target.groupId}:${target.subjectId}`));
    setGroups(current => current.filter(group => !groupIds.has(group.id)));
    setIcons(current => current.filter(icon => !iconKeys.has(`${icon.groupId}:${icon.subjectId}`)));
    try {
      const response = await fetch(`/api/projects/${projectId}/svg-sets`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePermanently", targets: targets.map(({ groupId, subjectId }) => ({ groupId, subjectId })) }) });
      if (!response.ok) throw new Error("Delete failed");
      targets.forEach(({ groupId, subjectId }) => onDeleted({ groupId, subjectId }));
    } catch {
      setGroups(previousGroups);
      setIcons(previousIcons);
      setFailed(true);
    } finally {
      setDeleting(current => { const next = new Set(current); keysToDelete.forEach(key => next.delete(key)); return next; });
      setBatchBusy(false);
    }
  };
  const requestPermanentDelete = (targets: DeleteTarget[]) => setDeletePrompt({ targets });
  const selectedRestoreTargets: RestoreTarget[] = category === "groups"
    ? groups.filter(group => selected.has(group.id)).map(group => ({ groupId: group.id, label: group.plan.summary || (zh ? "图标组" : "Icon group"), icons: group.icons }))
    : icons.filter(icon => selected.has(`${icon.groupId}:${icon.subjectId}`)).map(icon => ({ groupId: icon.groupId, subjectId: icon.subjectId, label: icon.name, svg: icon.svg }));
  const selectedDeleteTargets = selectedRestoreTargets.map(({ groupId, subjectId, label }) => ({ groupId, subjectId, label }));
  const batchBar = keys.length ? <div className={css.batchBar}>
    <label className={css.selectAll}><input type="checkbox" checked={selected.size === keys.length} ref={input => { if (input) input.indeterminate = selected.size > 0 && selected.size < keys.length; }} onChange={() => setSelected(selected.size === keys.length ? new Set() : new Set(keys))} /><span>{zh ? "全选" : "Select all"}</span></label>
    <span className={css.selectedCount}>{zh ? `已选 ${selected.size} 项` : `${selected.size} selected`}</span>
    <div className={css.batchActions}><button type="button" disabled={!selected.size || batchBusy} onClick={() => void restoreMany(selectedRestoreTargets)}>{zh ? "恢复所选" : "Restore selected"}</button><button type="button" className={css.batchDelete} disabled={!selected.size || batchBusy} onClick={() => requestPermanentDelete(selectedDeleteTargets)}>{zh ? "永久删除所选" : "Delete selected"}</button></div>
  </div> : null;
  const emptyLabel = category === "groups" ? (zh ? "暂无回收图标组" : "No recycled icon groups") : (zh ? "暂无回收单图" : "No recycled single icons");
  const empty = <div className={css.empty}><svg viewBox="0 0 24 24" style={{ fill: "none" }} aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg><p>{emptyLabel}</p></div>;
  return <><ProjectCollectionDialog open={open} title={zh ? "废纸篓" : "Recycle bin"} closeLabel={zh ? "关闭废纸篓" : "Close recycle bin"} tabsLabel={zh ? "回收分类" : "Recycle categories"} categories={{ groups: zh ? "整组回收" : "Recycled groups", icons: zh ? "单图回收" : "Recycled icons" }} category={category} onCategoryChange={changeCategory} onClose={() => { setSelected(new Set()); setDeletePrompt(null); onClose(); }}>
    {loading ? <div className={css.empty}><p>{zh ? "加载中…" : "Loading…"}</p></div> : failed ? <div className={css.empty}><p>{zh ? "回收内容加载失败" : "Couldn't load recycled items"}</p><button type="button" className={css.retry} onClick={() => void load()}>{zh ? "重试" : "Retry"}</button></div> : category === "groups" ? (groups.length ? <div className={css.grid}>{groups.map(group => <article className={css.card} role="checkbox" tabIndex={0} aria-checked={selected.has(group.id)} aria-label={zh ? `选择回收图标组：${group.plan.summary || "图标组"}` : `Select recycled group: ${group.plan.summary || "Icon group"}`} data-selected={selected.has(group.id) || undefined} onClick={event => handleCardClick(event, group.id)} onKeyDown={event => handleCardKeyDown(event, group.id)} key={group.id}>
      <span className={css.itemSelect} data-checked={selected.has(group.id) || undefined} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.5 3.5 7.5-8" /></svg></span>
      <div className={css.preview}>{Object.entries(group.icons).slice(0, 6).map(([id, svg]) => <span key={id}><img src={svgUrl(svg)} alt="" /></span>)}</div>
      <div className={css.meta}><strong>{group.plan.summary || (zh ? "图标组" : "Icon group")}</strong><span>{zh ? `${group.plan.count ?? Object.keys(group.icons).length} 个图标` : `${group.plan.count ?? Object.keys(group.icons).length} icons`}</span></div>
      <footer className={`${css.actions} ${css.recycleActions}`}><button type="button" className={css.recycleIconAction} data-tooltip={zh ? "恢复整组" : "Restore group"} aria-label={zh ? "恢复整组" : "Restore group"} onClick={() => void restoreMany([{ groupId: group.id, label: group.plan.summary || (zh ? "图标组" : "Icon group"), icons: group.icons }])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8v5h5M5.6 16a8 8 0 1 0 .3-8.3L4 10"/></svg></button><button type="button" className={`${css.recycleIconAction} ${css.permanentDelete}`} data-tooltip={zh ? "永久删除" : "Delete permanently"} aria-label={zh ? "永久删除" : "Delete permanently"} disabled={deleting.has(`${group.id}:group`)} onClick={() => requestPermanentDelete([{ groupId: group.id, label: group.plan.summary || (zh ? "图标组" : "Icon group") }])}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg></button></footer>
    </article>)}</div> : empty) : (icons.length ? <div className={`${css.grid} ${css.libraryGrid}`}>{icons.map(icon => { const key = `${icon.groupId}:${icon.subjectId}`; return <article className={css.card} role="checkbox" tabIndex={0} aria-checked={selected.has(key)} aria-label={zh ? `选择回收单图：${icon.name}` : `Select recycled icon: ${icon.name}`} data-selected={selected.has(key) || undefined} onClick={event => handleCardClick(event, key)} onKeyDown={event => handleCardKeyDown(event, key)} key={key}>
      <span className={css.itemSelect} data-checked={selected.has(key) || undefined} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.5 3.5 7.5-8" /></svg></span>
      <div className={`${css.libraryCard} ${css.recycledLibraryCard}`}><img src={svgUrl(icon.svg)} alt="" /><strong>{icon.name}</strong></div>
      <footer className={`${css.actions} ${css.recycleActions}`}><button type="button" onClick={() => void restoreMany([{ groupId: icon.groupId, subjectId: icon.subjectId, label: icon.name, svg: icon.svg }])}>{zh ? "恢复单图" : "Restore"}</button><button type="button" className={css.permanentDelete} disabled={deleting.has(key)} onClick={() => requestPermanentDelete([{ groupId: icon.groupId, subjectId: icon.subjectId, label: icon.name }])}>{zh ? "永久删除" : "Delete"}</button></footer>
    </article>; })}</div> : empty)}
    {!loading && !failed ? batchBar : null}
  </ProjectCollectionDialog>{deletePrompt ? <PermanentDeleteDialog
    targets={deletePrompt.targets}
    zh={zh}
    onClose={() => setDeletePrompt(null)}
    onConfirm={() => {
      const { targets } = deletePrompt;
      setDeletePrompt(null);
      void permanentlyDeleteMany(targets);
    }}
  /> : null}</>;
}
