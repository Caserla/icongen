/* eslint-disable @next/next/no-img-element -- Generated SVG data URLs and download previews must remain local and unoptimized. */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { IconPlan } from "../icon-plan";
import { withIconGenerationSlot } from "../icon-generation-limiter";
import css from "./icon-plan-results.module.css";
export type PlanResult = { id: string; plan: IconPlan; snapshot: unknown; position?: GroupPosition; layoutSize?: { width: number; height: number }; favorite?: boolean; recycled?: boolean; favoriteIconIds?: string[]; recycledIconIds?: string[]; saved?: boolean; icons?: Record<string, string> };
type Item = { status: "queued" | "processing" | "completed" | "failed"; svg?: string; error?: string };
type CanvasTool = "select" | "hand" | "none";
type GroupPosition = { x: number; y: number };

function PlanGroup({ result, zh, onBusyChange, actionBusy, tool, scale, position, isSelected, selectedIconId, isRaised, onSelect, onSelectIcon, onIconGenerated, onRetryError, onMove, onMoveEnd, onFocus, onToggleFavorite, onToggleIconFavorite, onRecycleIcon, onExport, onDelete }: { result: PlanResult; zh: boolean; onBusyChange: (id: string, busy: boolean) => void; actionBusy: boolean; tool: CanvasTool; scale: number; position: GroupPosition; isSelected: boolean; selectedIconId: string | null; isRaised: boolean; onSelect: () => void; onSelectIcon: (id: string) => void; onIconGenerated: (id: string, svg: string) => void; onRetryError: () => void; onMove: (position: GroupPosition) => GroupPosition; onMoveEnd: (position: GroupPosition) => void; onFocus: (element: HTMLElement) => void; onToggleFavorite: () => void; onToggleIconFavorite: (id: string) => void; onRecycleIcon: (id: string) => void; onExport: () => void; onDelete: () => void }) {
  const [items, setItems] = useState<Record<string, Item>>(() => Object.fromEntries(Object.entries(result.icons ?? {}).map(([id, svg]) => [id, { status: "completed", svg }])));
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const group = useRef<HTMLElement>(null);
  const groupDrag = useRef<{ pointerId: number; clientX: number; clientY: number; latestX: number; latestY: number; frame: number | null; originX: number; originY: number; lastPosition: GroupPosition; moved: boolean } | null>(null);
  const [moving, setMoving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const retrying = useRef<Set<string>>(new Set());
  async function generate(subject: IconPlan["subjects"][number], signal: AbortSignal, notifyFailure = false) {
    setItems(current => ({ ...current, [subject.id]: { status: "processing" } }));
    try {
      await withIconGenerationSlot(signal, async () => {
      const snapshot = result.snapshot as { styleId: string; colors?: unknown; theme?: "light" | "dark" };
      let payload: { svg?: string; message?: string } | null = null;
      let generationError = "Generation failed";
      for (let attempt = 0; attempt < 2 && !signal.aborted; attempt += 1) {
        try {
          const response = await fetch("/api/generation/svg-icon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, subject }), signal });
          const candidate = await response.json().catch(() => null) as { svg?: string; message?: string } | null;
          if (response.ok && candidate?.svg) { payload = candidate; break; }
          generationError = candidate?.message || `Generation failed (${response.status})`;
          // The SVG endpoint already performs one style/validation correction.
          // Only repeat the whole network request for a temporary provider
          // failure; validation and configuration failures must not multiply
          // into four expensive model calls per icon.
          if (response.status !== 429 && response.status < 500) break;
        } catch (error) {
          if (signal.aborted) throw error;
          generationError = error instanceof Error ? error.message : "Generation failed";
        }
      }
      if (!payload?.svg) throw new Error(generationError);
      const projectId = (result.snapshot as { projectId: string }).projectId;
      const saved = await fetch(`/api/projects/${projectId}/svg-sets/${result.id}/icons`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId: subject.id, svg: payload.svg }), signal });
      if (!saved.ok) { const detail = await saved.json().catch(() => null); throw new Error(detail?.message || "Icon save failed"); }
      if (!signal.aborted) { setItems(current => ({ ...current, [subject.id]: { status: "completed", svg: payload.svg } })); onIconGenerated(subject.id, payload.svg); }
      });
    } catch (error) { if (!signal.aborted) { setItems(current => ({ ...current, [subject.id]: { status: "failed", error: error instanceof Error ? error.message : "Generation failed" } })); if (notifyFailure) onRetryError(); } }
  }
  useEffect(() => {
    const controller = new AbortController(); abort.current = controller;
    if (result.saved) {
      onBusyChange(`${result.id}:pending`, false);
      return () => controller.abort();
    }
    // A unique key keeps a stale aborted run (including React Strict Mode's
    // first effect pass) from unlocking a newer run of the same icon set.
    const busyId = `${result.id}:batch:${crypto.randomUUID()}`;
    onBusyChange(busyId, true);
    let next = 0;
    const worker = async () => { while (!controller.signal.aborted && next < result.plan.subjects.length) await generate(result.plan.subjects[next++], controller.signal); };
    const concurrency = Math.min(6, result.plan.subjects.length);
    void Promise.all(Array.from({ length: concurrency }, () => worker())).finally(() => onBusyChange(busyId, false));
    return () => { controller.abort(); onBusyChange(busyId, false); };
    // Each immutable result owns one generation queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);
  const complete = Object.values(items).filter(item => item.status === "completed").length;
  const failed = Object.values(items).filter(item => item.status === "failed").length;
  const svg = selected ? items[selected]?.svg ?? result.icons?.[selected] : undefined;
  const subject = result.plan.subjects.find(subject => subject.id === selected);
  const visibleSubjects = result.plan.subjects.filter(subject => !(result.recycledIconIds ?? []).includes(subject.id));
  const singleSelectionId = selectedIconId ?? (isSelected && visibleSubjects.length === 1 ? visibleSubjects[0]?.id ?? null : null);
  const imageUrl = (value: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  const startGroupMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (tool !== "select" || event.button !== 0 || !event.isPrimary) return;
    if ((event.target as Element).closest("[data-icon-item], [data-canvas-controls]")) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    groupDrag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, latestX: event.clientX, latestY: event.clientY, frame: null, originX: position.x, originY: position.y, lastPosition: position, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMoving(true);
  };
  const applyGroupMove = (active: NonNullable<typeof groupDrag.current>) => {
    const moved = Math.abs(active.latestX - active.clientX) > 3 || Math.abs(active.latestY - active.clientY) > 3;
    if (!moved) return;
    const next = { x: active.originX + (active.latestX - active.clientX) / scale, y: active.originY + (active.latestY - active.clientY) / scale };
    active.lastPosition = onMove(next);
    active.moved = true;
  };
  const moveGroup = (event: ReactPointerEvent<HTMLElement>) => {
    const active = groupDrag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    active.latestX = event.clientX;
    active.latestY = event.clientY;
    if (active.frame !== null) return;
    active.frame = requestAnimationFrame(() => {
      active.frame = null;
      if (groupDrag.current === active) applyGroupMove(active);
    });
  };
  const stopGroupMove = (event?: ReactPointerEvent<HTMLElement>) => {
    if (event && groupDrag.current?.pointerId !== event.pointerId) return;
    const completed = groupDrag.current;
    if (completed) {
      if (completed.frame !== null) cancelAnimationFrame(completed.frame);
      if (event) { completed.latestX = event.clientX; completed.latestY = event.clientY; }
      applyGroupMove(completed);
    }
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    groupDrag.current = null;
    setMoving(false);
    if (completed?.moved) onMoveEnd(completed.lastPosition);
  };
  return <section ref={group} className={css.group} data-canvas-glass data-canvas-icon-group data-group-id={result.id} data-selected={isSelected || undefined} data-raised={isRaised || undefined} data-moving={moving || undefined} style={{ "--group-columns": Math.max(1, Math.min(result.plan.subjects.length, 5)), "--group-width": `${Math.min(result.plan.subjects.length, 5) * 152 + 36}px`, "--group-x": `${position.x}px`, "--group-y": `${position.y}px` } as CSSProperties}
    onPointerDown={startGroupMove} onPointerMove={moveGroup} onPointerUp={stopGroupMove} onPointerCancel={stopGroupMove} onLostPointerCapture={() => stopGroupMove()}
    onClickCapture={event => { if (tool === "select" && !(event.target as Element).closest("[data-icon-item], [data-canvas-controls]")) { event.preventDefault(); event.stopPropagation(); onSelect(); } }}
    onDoubleClick={event => { if (tool !== "select") return; event.preventDefault(); event.stopPropagation(); onSelect(); onFocus(event.currentTarget); }}>
    {isSelected && visibleSubjects.length > 1 ? <div className={css.groupActions} data-canvas-controls data-canvas-pan-surface data-icon-group-actions onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button type="button" disabled={actionBusy} data-tooltip={zh ? "整组收藏" : "Favorite group"} aria-label={result.favorite ? (zh ? "取消收藏图标组" : "Remove icon group from favorites") : (zh ? "收藏图标组" : "Favorite icon group")} aria-pressed={Boolean(result.favorite)} onClick={onToggleFavorite}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg>
      </button>
      <button type="button" disabled={actionBusy} data-tooltip={zh ? "整组下载" : "Download group"} aria-label={zh ? "导出图标组" : "Export icon group"} onClick={onExport}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v3h16v-3" /></svg>
      </button>
      <button type="button" disabled={actionBusy || Boolean(result.favorite)} data-tooltip={result.favorite ? (zh ? "请先取消整组收藏" : "Remove the group from favorites first") : (zh ? "整组回收" : "Recycle group")} aria-label={zh ? "删除图标组" : "Delete icon group"} onClick={onDelete}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
      </button>
    </div> : null}
    <p className={css.summary} title={result.plan.summary}>{result.plan.fallback ? (zh ? "已按通用交互场景整理 20 组图标。" : "Using 20 common UI icons.") : result.plan.summary}</p>
    <div className={css.grid} data-canvas-pan-surface aria-busy={!result.saved && complete + failed < result.plan.count}>{result.plan.subjects.map(subject => { const item = items[subject.id] ?? (result.icons?.[subject.id] ? { status: "completed" as const, svg: result.icons[subject.id] } : undefined); const recycled = (result.recycledIconIds ?? []).includes(subject.id); if (recycled) return <article className={css.iconSpacer} key={subject.id} aria-hidden="true" />; return <article key={subject.id} data-icon-item={item?.svg ? "" : undefined} data-selected={selectedIconId === subject.id || undefined} onClick={event => { if (tool === "select" && item?.svg) { event.stopPropagation(); onSelectIcon(subject.id); onFocus(event.currentTarget); } }} onDoubleClick={event => { if (tool === "select") event.stopPropagation(); }}>
      {singleSelectionId === subject.id ? <div className={`${css.groupActions} ${css.iconActions}`} data-canvas-controls data-canvas-pan-surface data-icon-group-actions onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button type="button" disabled={actionBusy} data-tooltip={zh ? "单图收藏" : "Favorite icon"} aria-label={result.favoriteIconIds?.includes(singleSelectionId) ? (zh ? "取消收藏单图" : "Remove icon from favorites") : (zh ? "收藏单图" : "Favorite icon")} aria-pressed={Boolean(result.favoriteIconIds?.includes(singleSelectionId))} onClick={() => onToggleIconFavorite(singleSelectionId)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg>
      </button>
      <button type="button" disabled={actionBusy} data-tooltip={zh ? "单图下载" : "Download icon"} aria-label={zh ? "下载单图" : "Download icon"} onClick={() => {
        const iconSvg = items[singleSelectionId]?.svg ?? result.icons?.[singleSelectionId];
        if (!iconSvg) return;
        const anchor = document.createElement("a"); anchor.href = imageUrl(iconSvg); anchor.download = `${singleSelectionId}.svg`; document.body.append(anchor); anchor.click(); anchor.remove();
      }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v3h16v-3" /></svg>
      </button>
      <button type="button" disabled={actionBusy || Boolean(result.favoriteIconIds?.includes(singleSelectionId))} data-tooltip={result.favoriteIconIds?.includes(singleSelectionId) ? (zh ? "请先取消单图收藏" : "Remove the icon from favorites first") : (zh ? "单图回收" : "Recycle icon")} aria-label={zh ? "回收单图" : "Recycle icon"} onClick={() => onRecycleIcon(singleSelectionId)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
      </button>
    </div> : null}
      {item?.svg ? <button className={css.iconButton} data-canvas-controls aria-label={tool === "select" ? (zh ? `选中 ${subject.name}` : `Select ${subject.name}`) : (zh ? `查看 ${subject.name}` : `View ${subject.name}`)} aria-pressed={tool === "select" ? selectedIconId === subject.id : undefined} onClick={() => { if (tool !== "select") { setSelected(subject.id); dialog.current?.showModal(); } }}><img src={imageUrl(item.svg)} alt={subject.name} /></button> : (item?.status === "failed" || (result.saved && item?.status !== "processing")) ? <button className={css.failedPreview} data-canvas-controls aria-label={zh ? `重试生成 ${subject.name}` : `Retry generating ${subject.name}`} onClick={() => { if (abort.current && !retrying.current.has(subject.id)) { retrying.current.add(subject.id); const busyId = `${result.id}:${subject.id}`; onBusyChange(busyId, true); void generate(subject, abort.current.signal, true).finally(() => { retrying.current.delete(subject.id); onBusyChange(busyId, false); }); } }}>
        <span className={css.brokenImage} aria-hidden="true"><svg viewBox="0 0 48 48">
          <g className={css.leftFragment}><path d="M7 12h15l-4 9 6 6-5 11H7z"/><path d="m9 34 8-9 5 5"/></g>
          <g className={css.rightFragment}><path d="M28 12h13v26H21l5-11-6-6 5-9z"/><path d="m28 31 4-4 7 8"/></g>
        </svg></span>
        <span className={css.retryAction} aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M13 6a5.5 5.5 0 1 0 .1 3"/><path d="M10.5 3.5H13V6"/></svg></span>
      </button> : <span className={`${css.placeholder} ${!item || item.status === "queued" || item.status === "processing" ? css.loading : ""}`} aria-hidden="true" />}
      <span>{subject.name}</span>
    </article>; })}</div>
    <dialog ref={dialog} className={css.detail} data-canvas-controls onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <button className={css.close} onClick={() => dialog.current?.close()} aria-label={zh ? "关闭" : "Close"}>×</button>
      <h3>{subject?.name}</h3>
      {svg && <><img className={css.large} src={imageUrl(svg)} alt={subject?.name || "Icon"} /><a href={imageUrl(svg)} download={`${subject?.id || "icon"}.svg`}>{zh ? "下载 SVG" : "Download SVG"}</a></>}
    </dialog>
  </section>;
}
export function IconPlanResults({ results, zh, onBusyChange, actionBusyKeys, tool, scale, selectedGroupId, selectedIcon, raisedGroupId, positions, onSelectGroup, onSelectIcon, onIconGenerated, onRetryError, onMoveGroup, onMoveGroupEnd, onFocusGroup, onToggleFavorite, onToggleIconFavorite, onRecycleIcon, onExportGroup, onDeleteGroup }: { results: PlanResult[]; busy: boolean; zh: boolean; onBusyChange: (id: string, busy: boolean) => void; actionBusyKeys: Set<string>; tool: CanvasTool; scale: number; selectedGroupId: string | null; selectedIcon: { groupId: string; subjectId: string } | null; raisedGroupId: string | null; positions: Record<string, GroupPosition>; onSelectGroup: (id: string) => void; onSelectIcon: (groupId: string, subjectId: string) => void; onIconGenerated: (groupId: string, subjectId: string, svg: string) => void; onRetryError: () => void; onMoveGroup: (id: string, position: GroupPosition) => GroupPosition; onMoveGroupEnd: (id: string, position: GroupPosition) => void; onFocusGroup: (element: HTMLElement) => void; onToggleFavorite: (id: string) => void; onToggleIconFavorite: (groupId: string, subjectId: string) => void; onRecycleIcon: (groupId: string, subjectId: string) => void; onExportGroup: (id: string) => void; onDeleteGroup: (id: string) => void }) {
  return <div className={css.results} data-icon-plan-results aria-live="polite">
    {results.map(result => {
      const position = positions[result.id] ?? result.position ?? { x: 0, y: 0 };
      const fullyRecycled = result.recycled || (result.plan.subjects.length > 0 && (result.recycledIconIds?.length ?? 0) >= result.plan.subjects.length);
      if (fullyRecycled) {
        const columns = Math.max(1, Math.min(result.plan.subjects.length, 5));
        const rows = Math.max(1, Math.ceil(result.plan.subjects.length / 5));
        const size = result.layoutSize ?? { width: columns * 152 + 36, height: 71 + rows * 126 + (rows - 1) * 12 };
        return <div key={result.id} className={css.groupSpacer} aria-hidden="true" style={{ "--group-x": `${position.x}px`, "--group-y": `${position.y}px`, width: size.width, height: size.height } as CSSProperties} />;
      }
      const selectedSubjectId = selectedIcon?.groupId === result.id ? selectedIcon.subjectId : null;
      const actionKey = selectedSubjectId || (selectedGroupId === result.id && result.plan.subjects.length === 1) ? `icon:${result.id}:${selectedSubjectId ?? result.plan.subjects[0]?.id}` : `group:${result.id}`;
      return <PlanGroup key={result.id} result={result} zh={zh} onBusyChange={onBusyChange} actionBusy={actionBusyKeys.has(actionKey)} tool={tool} scale={scale} position={position} isSelected={selectedGroupId === result.id} selectedIconId={selectedSubjectId} isRaised={raisedGroupId === result.id} onSelect={() => onSelectGroup(result.id)} onSelectIcon={subjectId => onSelectIcon(result.id, subjectId)} onIconGenerated={(subjectId, svg) => onIconGenerated(result.id, subjectId, svg)} onRetryError={onRetryError} onMove={next => onMoveGroup(result.id, next)} onMoveEnd={next => onMoveGroupEnd(result.id, next)} onFocus={onFocusGroup} onToggleFavorite={() => onToggleFavorite(result.id)} onToggleIconFavorite={subjectId => onToggleIconFavorite(result.id, subjectId)} onRecycleIcon={subjectId => onRecycleIcon(result.id, subjectId)} onExport={() => onExportGroup(result.id)} onDelete={() => onDeleteGroup(result.id)} />;
    })}
  </div>;
}
