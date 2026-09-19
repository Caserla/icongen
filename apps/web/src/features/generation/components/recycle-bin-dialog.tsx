"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import css from "./favorite-icon-groups-dialog.module.css";
import { ProjectCollectionDialog } from "./project-collection-dialog";

type RecycledGroup = { id: string; plan: { summary?: string; count?: number }; icons: Record<string, string> };
type RecycledIcon = { groupId: string; subjectId: string; name: string; svg: string };
type DeleteTarget = { groupId: string; subjectId?: string; label: string };
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function PermanentDeleteDialog({ step, target, zh, onClose, onContinue, onConfirm }: { step: 1 | 2; target: DeleteTarget; zh: boolean; onClose: () => void; onContinue: () => void; onConfirm: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const finalStep = step === 2;
  return <dialog
    ref={dialogRef}
    className={css.confirmDialog}
    aria-labelledby={`permanent-delete-title-${step}`}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <button type="button" className={css.confirmClose} aria-label={zh ? "关闭确认弹窗" : "Close confirmation"} onClick={onClose}>×</button>
    <div className={`${css.confirmMark} ${finalStep ? css.confirmMarkDanger : css.confirmMarkWarning}`} aria-hidden="true">!</div>
    <h2 id={`permanent-delete-title-${step}`}>{finalStep ? (zh ? "删除后无法恢复" : "This cannot be undone") : (zh ? "确认永久删除？" : "Delete permanently?")}</h2>
    <p>{finalStep
      ? (zh ? `这是最后一次确认。“${target.label}”永久删除后将无法找回。` : `This is the final confirmation. “${target.label}” cannot be recovered after deletion.`)
      : (zh ? `你将永久删除“${target.label}”，请确认是否继续。` : `You are about to permanently delete “${target.label}”. Do you want to continue?`)}</p>
    <footer className={css.confirmActions}>
      <button type="button" onClick={onClose}>{finalStep ? (zh ? "返回" : "Back") : (zh ? "取消" : "Cancel")}</button>
      <button type="button" className={css.confirmDanger} onClick={finalStep ? onConfirm : onContinue}>{finalStep ? (zh ? "确认永久删除" : "Delete permanently") : (zh ? "继续" : "Continue")}</button>
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
  const [deletePrompt, setDeletePrompt] = useState<{ target: DeleteTarget; step: 1 | 2 } | null>(null);
  useEffect(() => { setDeletePrompt(null); }, [open, category]);
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
    if (open) void load();
  }, [open, load]);
  const restore = async (groupId: string, subjectId?: string, svg?: string, icons?: Record<string, string>) => {
    if (!projectId) return;
    onClose();
    const path = subjectId ? `/api/projects/${projectId}/svg-sets/${groupId}/icons/${encodeURIComponent(subjectId)}` : `/api/projects/${projectId}/svg-sets/${groupId}`;
    const response = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recycled: false }) });
    if (!response.ok) { setFailed(true); return; }
    onRestored({ groupId, subjectId, svg, icons });
  };
  const permanentlyDelete = async (groupId: string, subjectId?: string) => {
    if (!projectId) return;
    const key = `${groupId}:${subjectId ?? "group"}`;
    if (deleting.has(key)) return;
    const previousGroups = groups;
    const previousIcons = icons;
    setDeleting(current => new Set(current).add(key));
    if (subjectId) setIcons(current => current.filter(icon => !(icon.groupId === groupId && icon.subjectId === subjectId)));
    else setGroups(current => current.filter(group => group.id !== groupId));
    try {
      const path = subjectId ? `/api/projects/${projectId}/svg-sets/${groupId}/icons/${encodeURIComponent(subjectId)}` : `/api/projects/${projectId}/svg-sets/${groupId}`;
      const response = await fetch(path, { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      onDeleted({ groupId, subjectId });
    } catch {
      setGroups(previousGroups);
      setIcons(previousIcons);
      setFailed(true);
    } finally {
      setDeleting(current => { const next = new Set(current); next.delete(key); return next; });
    }
  };
  const requestPermanentDelete = (target: DeleteTarget) => setDeletePrompt({ target, step: 1 });
  const emptyLabel = category === "groups" ? (zh ? "暂无回收图标组" : "No recycled icon groups") : (zh ? "暂无回收单图" : "No recycled single icons");
  const empty = <div className={css.empty}><svg viewBox="0 0 24 24" style={{ fill: "none" }} aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg><p>{emptyLabel}</p></div>;
  return <><ProjectCollectionDialog open={open} title={zh ? "废纸篓" : "Recycle bin"} closeLabel={zh ? "关闭废纸篓" : "Close recycle bin"} tabsLabel={zh ? "回收分类" : "Recycle categories"} categories={{ groups: zh ? "整组回收" : "Recycled groups", icons: zh ? "单图回收" : "Recycled icons" }} category={category} onCategoryChange={setCategory} onClose={onClose}>
    {loading ? <div className={css.empty}><p>{zh ? "加载中…" : "Loading…"}</p></div> : failed ? <div className={css.empty}><p>{zh ? "回收内容加载失败" : "Couldn't load recycled items"}</p><button type="button" className={css.retry} onClick={() => void load()}>{zh ? "重试" : "Retry"}</button></div> : category === "groups" ? (groups.length ? <div className={css.grid}>{groups.map(group => <article className={css.card} key={group.id}>
      <div className={css.preview}>{Object.entries(group.icons).slice(0, 6).map(([id, svg]) => <span key={id}><img src={svgUrl(svg)} alt="" /></span>)}</div>
      <div className={css.meta}><strong>{group.plan.summary || (zh ? "图标组" : "Icon group")}</strong><span>{zh ? `${group.plan.count ?? Object.keys(group.icons).length} 个图标` : `${group.plan.count ?? Object.keys(group.icons).length} icons`}</span></div>
      <footer className={`${css.actions} ${css.recycleActions}`}><button type="button" onClick={() => void restore(group.id, undefined, undefined, group.icons)}>{zh ? "恢复整组" : "Restore"}</button><button type="button" className={css.permanentDelete} disabled={deleting.has(`${group.id}:group`)} onClick={() => requestPermanentDelete({ groupId: group.id, label: group.plan.summary || (zh ? "图标组" : "Icon group") })}>{zh ? "永久删除" : "Delete"}</button></footer>
    </article>)}</div> : empty) : (icons.length ? <div className={`${css.grid} ${css.libraryGrid}`}>{icons.map(icon => <article className={css.card} key={`${icon.groupId}:${icon.subjectId}`}>
      <div className={`${css.libraryCard} ${css.recycledLibraryCard}`}><img src={svgUrl(icon.svg)} alt="" /><strong>{icon.name}</strong></div>
      <footer className={`${css.actions} ${css.recycleActions}`}><button type="button" onClick={() => void restore(icon.groupId, icon.subjectId, icon.svg)}>{zh ? "恢复单图" : "Restore"}</button><button type="button" className={css.permanentDelete} disabled={deleting.has(`${icon.groupId}:${icon.subjectId}`)} onClick={() => requestPermanentDelete({ groupId: icon.groupId, subjectId: icon.subjectId, label: icon.name })}>{zh ? "永久删除" : "Delete"}</button></footer>
    </article>)}</div> : empty)}
  </ProjectCollectionDialog>{deletePrompt ? <PermanentDeleteDialog
    key={deletePrompt.step}
    step={deletePrompt.step}
    target={deletePrompt.target}
    zh={zh}
    onClose={() => setDeletePrompt(null)}
    onContinue={() => setDeletePrompt(current => current ? { ...current, step: 2 } : null)}
    onConfirm={() => {
      const { groupId, subjectId } = deletePrompt.target;
      setDeletePrompt(null);
      void permanentlyDelete(groupId, subjectId);
    }}
  /> : null}</>;
}
