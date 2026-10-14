/* eslint-disable @next/next/no-img-element -- Generated SVG data URLs and download previews must remain local and unoptimized. */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { IconPlan } from "../icon-plan";
import { withIconGenerationSlot } from "../icon-generation-limiter";
import css from "./icon-plan-results.module.css";
import { runGenerationBatch, requestGenerationJson, isSubjectGenerationFailure, type GenerationOutcome } from "../generation-batch";
import { useTheme } from "@/components/i18n/theme-switch";
import { themeDisplaySvg } from "../theme-display-svg";
import { generationSubjectLabel } from "../generation-subject-label";
import { isLibraryGenerationStyle } from "../library-generation-styles";
export type PlanResult = { id: string; plan: IconPlan; snapshot: unknown; position?: GroupPosition; layoutSize?: { width: number; height: number }; favorite?: boolean; recycled?: boolean; favoriteIconIds?: string[]; recycledIconIds?: string[]; saved?: boolean; icons?: Record<string, string>; generationContexts?: Record<string, { reviewStatus?: string }> };
type Item = { status: "queued" | "processing" | "completed" | "failed"; svg?: string; error?: string; reviewStatus?: string };
type GeneratedDraft = { svg?: string; svgs?: { outline?: string; solid?: string }; variants?: Record<string, string>; reviewStatus?: string; generationContext?: { reviewStatus?: string; [key: string]: unknown } };
type CanvasTool = "select" | "hand";
type GroupPosition = { x: number; y: number };
type Subject = IconPlan["subjects"][number];
type GenerationUnit = { subject: Subject } | { outline: Subject; solid: Subject } | { main: Subject; secondary: Subject };

function PlanGroup({ result, zh, onBusyChange, actionBusy, tool, scale, position, isSelected, selectedIconId, isRaised, onSelect, onSelectIcon, onIconGenerated, onRetryError, onMove, onMoveEnd, onFocus, onToggleFavorite, onToggleIconFavorite, onRecycleIcon, onExport, onExportIcon, onDelete }: { result: PlanResult; zh: boolean; onBusyChange: (id: string, busy: boolean) => void; actionBusy: boolean; tool: CanvasTool; scale: number; position: GroupPosition; isSelected: boolean; selectedIconId: string | null; isRaised: boolean; onSelect: () => void; onSelectIcon: (id: string) => void; onIconGenerated: (id: string, svg: string, context?: { reviewStatus?: string; [key: string]: unknown }) => void; onRetryError: () => void; onMove: (position: GroupPosition) => GroupPosition; onMoveEnd: (position: GroupPosition) => void; onFocus: (element: HTMLElement) => void; onToggleFavorite: () => void; onToggleIconFavorite: (id: string) => void; onRecycleIcon: (id: string) => void; onExport: () => void; onExportIcon: (id: string) => void; onDelete: () => void }) {
  const theme = useTheme();
  const [items, setItems] = useState<Record<string, Item>>(() => Object.fromEntries(Object.entries(result.icons ?? {}).map(([id, svg]) => [id, { status: "completed", svg, reviewStatus: result.generationContexts?.[id]?.reviewStatus }])));
  const group = useRef<HTMLElement>(null);
  const groupDrag = useRef<{ pointerId: number; clientX: number; clientY: number; latestX: number; latestY: number; frame: number | null; originX: number; originY: number; lastPosition: GroupPosition; moved: boolean } | null>(null);
  const [moving, setMoving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const retrying = useRef<Set<string>>(new Set());
  const generatedDrafts = useRef(new Map<string, GeneratedDraft>());
  const authoringContexts = useRef<Record<string, unknown>>({ ...result.generationContexts });
  const subjectFailures = useRef(new Set<string>());
  const [batchPaused, setBatchPaused] = useState(false);
  const statePairBaseId = (id: string) => {
    if (/-(outline|solid)$/.test(id)) return id.replace(/-(outline|solid)$/, "");
    // Legacy stored plans use sequential IDs for adjacent outline/solid pairs.
    const index = result.plan.subjects.findIndex(subject => subject.id === id);
    const subject = result.plan.subjects[index];
    const partner = subject?.state === "outline" ? result.plan.subjects[index + 1] : result.plan.subjects[index - 1];
    return partner && partner.state !== subject?.state && partner.name === subject?.name
      ? `legacy-${subject.state === "outline" ? index : index - 1}` : id;
  };
  const stylePairBaseId = (id: string) => id.replace(/-(main|secondary)$/, "");
  const stylePairUnits = (subjects: Subject[]): GenerationUnit[] => {
    const selected = new Set(subjects.map(subject => stylePairBaseId(subject.id)));
    return result.plan.subjects.filter(subject => subject.styleRole === "main" && selected.has(stylePairBaseId(subject.id))).map(main => ({ main, secondary: result.plan.subjects.find(subject => subject.styleRole === "secondary" && stylePairBaseId(subject.id) === stylePairBaseId(main.id)) })).filter((unit): unit is { main: Subject; secondary: Subject } => Boolean(unit.secondary));
  };
  async function saveGenerated(subjectId: string, svg: string, signal: AbortSignal, generationContext?: unknown, styleVariants?: Record<string, string>, requireContext = false) {
    const projectId = (result.snapshot as { projectId: string }).projectId;
    try {
      const response = await requestGenerationJson<{ generationContextSaved?: boolean }>(`/api/projects/${projectId}/svg-sets/${result.id}/icons`, { subjectId, svg, generationContext, styleVariants }, signal);
      if (requireContext && !response.generationContextSaved) throw new Error("六风格尚未持久化，请先完成数据库升级");
    }
    catch (error) { throw new Error(`保存失败，生成结果已暂存：${error instanceof Error ? error.message : "unknown error"}`); }
  }
  async function generate(subject: IconPlan["subjects"][number], signal: AbortSignal, notifyFailure = false, sourceSvg?: string, refine = false): Promise<string | undefined> {
    subjectFailures.current.delete(subject.id);
    setItems(current => ({ ...current, [subject.id]: { ...current[subject.id], status: "processing" } }));
    try {
      return await withIconGenerationSlot(signal, async () => {
      const snapshot = result.snapshot as { styleId: string; styleFamily?: boolean; secondaryStyleId?: string; colors?: unknown; theme?: "light" | "dark" };
      const colors = snapshot.colors;
      const styleId = subject.styleRole === "secondary" ? snapshot.secondaryStyleId : snapshot.styleId;
      if (!styleId) throw new Error("Missing secondary style");
      const candidate = items[subject.id]?.svg ?? result.icons?.[subject.id];
      const context = authoringContexts.current[subject.id];
      let savedVariants = context && typeof context === "object" && "styleVariants" in context ? (context as { styleVariants?: Record<string, string> }).styleVariants : undefined;
      if (refine && snapshot.styleFamily && context && candidate && !savedVariants) {
        const response = await fetch(`/api/projects/${(result.snapshot as { projectId: string }).projectId}/svg-sets/${result.id}/icons/${encodeURIComponent(subject.id)}`, { signal, cache: "no-store" });
        if (!response.ok) throw new Error("无法加载六风格结果以继续复核");
        savedVariants = (await response.json() as { variants: Record<string, string> }).variants;
      }
      const payload = generatedDrafts.current.get(subject.id) ?? await requestGenerationJson<GeneratedDraft>("/api/generation/svg-icon", { ...snapshot, styleId, sourceStyleId: sourceSvg ? snapshot.styleId : undefined, sourceSvg, colors, structureBlueprint: subject.structureBlueprint, subject,
        ...(refine && context && candidate ? { resume: { variants: snapshot.styleFamily && savedVariants ? savedVariants : { [styleId]: candidate }, context } } : {}),
      }, signal, `${(result.snapshot as { projectId?: string }).projectId}:${result.id}:${subject.id}`);
      const family = snapshot.styleFamily && isLibraryGenerationStyle(snapshot.styleId) && !snapshot.secondaryStyleId;
      const outputSvg = family ? payload.variants?.linear : payload?.svg;
      if (!outputSvg || (family && (!payload.variants || !payload.generationContext))) throw new Error("Missing SVG family output");
      generatedDrafts.current.set(subject.id, payload);
      const persistedContext = payload.generationContext;
      const localContext = family && persistedContext ? { ...persistedContext, styleVariants: payload.variants } : persistedContext;
      if (localContext) authoringContexts.current[subject.id] = localContext;
      await saveGenerated(subject.id, outputSvg, signal, persistedContext, family ? payload.variants : undefined, Boolean(family));
      generatedDrafts.current.delete(subject.id);
      if (!signal.aborted) { setItems(current => ({ ...current, [subject.id]: { status: "completed", svg: outputSvg, reviewStatus: payload.reviewStatus } })); onIconGenerated(subject.id, outputSvg, localContext); }
      return outputSvg;
      });
    } catch (error) { if (isSubjectGenerationFailure(error)) subjectFailures.current.add(subject.id); if (!signal.aborted) { setItems(current => ({ ...current, [subject.id]: { ...current[subject.id], status: current[subject.id]?.svg ? "completed" : "failed", error: error instanceof Error ? error.message : "Generation failed" } })); if (notifyFailure) onRetryError(); } return undefined; }
  }
  async function generateStylePair(main: Subject, secondary: Subject, signal: AbortSignal, notifyFailure = false, refine = false): Promise<boolean> {
    subjectFailures.current.delete(main.id); subjectFailures.current.delete(secondary.id);
    const snapshot = result.snapshot as { styleId: string; secondaryStyleId?: string; projectId: string };
    if (isLibraryGenerationStyle(snapshot.styleId) && snapshot.secondaryStyleId && isLibraryGenerationStyle(snapshot.secondaryStyleId)) {
      const available = { [snapshot.styleId]: items[main.id]?.svg ?? result.icons?.[main.id], [snapshot.secondaryStyleId]: items[secondary.id]?.svg ?? result.icons?.[secondary.id] };
      const hasBoth = Boolean(available[snapshot.styleId] && available[snapshot.secondaryStyleId]);
      if (hasBoth && !refine) return true;
      const context = authoringContexts.current[main.id] ?? authoringContexts.current[secondary.id];
      if (refine && (!context || !hasBoth)) { if (notifyFailure) onRetryError(); return false; }
      setItems(current => ({ ...current, ...Object.fromEntries([main, secondary].map(subject => [subject.id, { ...current[subject.id], status: "processing" }])) }));
      try {
        await withIconGenerationSlot(signal, async () => {
          const payload = generatedDrafts.current.get(main.id) ?? await requestGenerationJson<GeneratedDraft>("/api/generation/svg-icon", {
            ...snapshot, styleFamily: true, subject: { name: main.name, description: main.description },
            ...(refine ? { resume: { variants: available, context } } : { existingVariants: Object.fromEntries(Object.entries(available).filter((entry): entry is [string, string] => !!entry[1])) }),
          }, signal, `${snapshot.projectId}:${result.id}:${main.id}`);
          const first = (refine ? undefined : available[snapshot.styleId]) ?? payload.variants?.[snapshot.styleId];
          const second = (refine ? undefined : available[snapshot.secondaryStyleId!]) ?? payload.variants?.[snapshot.secondaryStyleId!];
          if (!first || !second) throw new Error("Missing style family output");
          generatedDrafts.current.set(main.id, payload);
          if (payload.generationContext) { authoringContexts.current[main.id] = payload.generationContext; authoringContexts.current[secondary.id] = payload.generationContext; }
          // Commit the same-subject pair atomically; retrying a save reuses the drawn result.
          await requestGenerationJson(`/api/projects/${snapshot.projectId}/svg-sets/${result.id}/icons`, { icons: [{ subjectId: main.id, svg: first, generationContext: payload.generationContext }, { subjectId: secondary.id, svg: second, generationContext: payload.generationContext }] }, signal);
          generatedDrafts.current.delete(main.id);
          if (!signal.aborted) {
            setItems(current => ({ ...current, [main.id]: { status: "completed", svg: first, reviewStatus: payload.reviewStatus }, [secondary.id]: { status: "completed", svg: second, reviewStatus: payload.reviewStatus } }));
            onIconGenerated(main.id, first, payload.generationContext); onIconGenerated(secondary.id, second, payload.generationContext);
          }
        });
        return true;
      } catch (error) {
        if (isSubjectGenerationFailure(error)) subjectFailures.current.add(main.id);
        if (!signal.aborted) {
          const failed: Item = { status: "failed", error: error instanceof Error ? error.message : "Generation failed" };
          setItems(current => ({ ...current, ...Object.fromEntries([main, secondary].map(subject => [subject.id, current[subject.id]?.svg ? { ...current[subject.id], status: "completed" } : failed])) }));
          if (notifyFailure) onRetryError();
        }
        return false;
      }
    }
    const mainSvg = items[main.id]?.svg ?? result.icons?.[main.id] ?? await generate(main, signal, notifyFailure);
    if (!mainSvg) return false;
    if (items[secondary.id]?.svg ?? result.icons?.[secondary.id]) return true;
    return Boolean(await generate(secondary, signal, notifyFailure, mainSvg));
  }
  async function generatePair(outline: IconPlan["subjects"][number], solid: IconPlan["subjects"][number], signal: AbortSignal, notifyFailure = false) {
    subjectFailures.current.delete(outline.id); subjectFailures.current.delete(solid.id);
    setItems(current => ({ ...current, [outline.id]: current[outline.id]?.svg ? current[outline.id] : { status: "processing" }, [solid.id]: current[solid.id]?.svg ? current[solid.id] : { status: "processing" } }));
    try {
      await withIconGenerationSlot(signal, async () => {
        const snapshot = result.snapshot as { styleId: string; colors?: unknown; theme?: "light" | "dark" };
        const colors = snapshot.colors;
        const existingStates = { outline: items[outline.id]?.svg, solid: items[solid.id]?.svg };
        const payload = generatedDrafts.current.get(outline.id) ?? await requestGenerationJson<{ svgs?: { outline?: string; solid?: string } }>("/api/generation/svg-icon", { ...snapshot, colors, pair: true, existingStates, structureBlueprint: outline.structureBlueprint, subject: { name: outline.name, description: outline.description } }, signal);
        const outlineSvg = existingStates.outline ?? payload?.svgs?.outline;
        const solidSvg = existingStates.solid ?? payload?.svgs?.solid;
        if (!outlineSvg || !solidSvg) throw new Error("Missing SVG pair output");
        generatedDrafts.current.set(outline.id, payload);
        const projectId = (result.snapshot as { projectId: string }).projectId;
        await requestGenerationJson(`/api/projects/${projectId}/svg-sets/${result.id}/icons`, { icons: [{ subjectId: outline.id, svg: outlineSvg }, { subjectId: solid.id, svg: solidSvg }] }, signal);
        generatedDrafts.current.delete(outline.id);
        if (!signal.aborted) {
          setItems(current => ({ ...current, [outline.id]: { status: "completed", svg: outlineSvg }, [solid.id]: { status: "completed", svg: solidSvg } }));
          onIconGenerated(outline.id, outlineSvg);
          onIconGenerated(solid.id, solidSvg);
        }
      });
      return true;
    } catch (error) {
      if (isSubjectGenerationFailure(error)) subjectFailures.current.add(outline.id);
      if (!signal.aborted) {
        const failed = { status: "failed" as const, error: error instanceof Error ? error.message : "Generation failed" };
        setItems(current => ({ ...current, [outline.id]: current[outline.id]?.svg ? current[outline.id] : failed, [solid.id]: current[solid.id]?.svg ? current[solid.id] : failed }));
        if (notifyFailure) onRetryError();
      }
      return false;
    }
  }
  async function runUnit(unit: GenerationUnit, signal: AbortSignal): Promise<GenerationOutcome> {
    const ok = "subject" in unit ? Boolean(await generate(unit.subject, signal)) : "main" in unit
      ? await generateStylePair(unit.main, unit.secondary, signal) : await generatePair(unit.outline, unit.solid, signal);
    if (ok) return true;
    const ids = "subject" in unit ? [unit.subject.id] : "main" in unit ? [unit.main.id, unit.secondary.id] : [unit.outline.id, unit.solid.id];
    return ids.some(id => subjectFailures.current.has(id)) ? "subject-failed" : false;
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
    const isStatePair = (result.snapshot as { styleId?: string }).styleId === "state-pair";
    const isStylePair = Boolean((result.snapshot as { secondaryStyleId?: string }).secondaryStyleId);
    const units: GenerationUnit[] = isStatePair
      ? result.plan.subjects.filter(subject => subject.state === "outline").map(outline => ({ outline, solid: result.plan.subjects.find(subject => subject.state === "solid" && statePairBaseId(subject.id) === statePairBaseId(outline.id)) })).filter((unit): unit is { outline: IconPlan["subjects"][number]; solid: IconPlan["subjects"][number] } => Boolean(unit.solid))
      : isStylePair ? stylePairUnits(result.plan.subjects)
      : result.plan.subjects.map(subject => ({ subject }));
    void runGenerationBatch(units, controller.signal, unit => runUnit(unit, controller.signal))
      .then(({ paused }) => { if (!controller.signal.aborted && paused) { setBatchPaused(true); onRetryError(); } })
      .finally(() => onBusyChange(busyId, false));
    return () => { controller.abort(); onBusyChange(busyId, false); };
    // Each immutable result owns one generation queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);
  const complete = Object.values(items).filter(item => item.status === "completed").length;
  const isRetryable = (subject: IconPlan["subjects"][number]) => {
    const item = items[subject.id];
    return item?.status === "failed" || ((result.saved || batchPaused) && !item?.svg && item?.status !== "processing");
  };
  const failed = result.plan.subjects.filter(isRetryable).length;
  const visibleSubjects = result.plan.subjects.filter(subject => !(result.recycledIconIds ?? []).includes(subject.id));
  const styleId = (result.snapshot as { styleId?: string })?.styleId ?? "";
  const subjectLabel = (subject: IconPlan["subjects"][number]) => generationSubjectLabel(subject, result.snapshot as { styleId?: string; secondaryStyleId?: string }, zh);
  const singleSelectionId = selectedIconId ?? (isSelected && visibleSubjects.length === 1 ? visibleSubjects[0]?.id ?? null : null);
  const imageUrl = (value: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  const retrySubject = (subject: IconPlan["subjects"][number], refine = false) => {
    const controller = abort.current;
    if (!controller || controller.signal.aborted || retrying.current.has(subject.id)) return;
    const pairId = statePairBaseId(subject.id);
    if (subject.styleRole) {
      const styleBaseId = stylePairBaseId(subject.id);
      const main = result.plan.subjects.find(candidate => candidate.styleRole === "main" && stylePairBaseId(candidate.id) === styleBaseId);
      const secondary = result.plan.subjects.find(candidate => candidate.styleRole === "secondary" && stylePairBaseId(candidate.id) === styleBaseId);
      if (main && secondary) {
        const busyId = `${result.id}:${styleBaseId}`;
        retrying.current.add(main.id); retrying.current.add(secondary.id);
        onBusyChange(busyId, true);
        void generateStylePair(main, secondary, controller.signal, true, refine).finally(() => {
          retrying.current.delete(main.id); retrying.current.delete(secondary.id);
          onBusyChange(busyId, false);
        });
        return;
      }
    }
    const outline = styleId === "state-pair" ? result.plan.subjects.find(candidate => candidate.state === "outline" && statePairBaseId(candidate.id) === pairId) : undefined;
    const solid = styleId === "state-pair" ? result.plan.subjects.find(candidate => candidate.state === "solid" && statePairBaseId(candidate.id) === pairId) : undefined;
    const busyId = `${result.id}:${pairId}`;
    if (outline && solid) {
      retrying.current.add(outline.id);
      retrying.current.add(solid.id);
      onBusyChange(busyId, true);
      void generatePair(outline, solid, controller.signal, true).finally(() => {
        retrying.current.delete(outline.id);
        retrying.current.delete(solid.id);
        onBusyChange(busyId, false);
      });
      return;
    }
    retrying.current.add(subject.id);
    onBusyChange(busyId, true);
    void generate(subject, controller.signal, true, undefined, refine).finally(() => {
      retrying.current.delete(subject.id);
      onBusyChange(busyId, false);
    });
  };
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
    onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); onSelect(); onFocus(event.currentTarget); }}>
    {isSelected && visibleSubjects.length > 1 ? <div className={css.groupActions} data-canvas-controls data-canvas-pan-surface data-icon-group-actions onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button type="button" disabled={actionBusy} data-busy={actionBusy || undefined} data-tooltip={zh ? "整组收藏" : "Favorite group"} aria-label={result.favorite ? (zh ? "取消收藏图标组" : "Remove icon group from favorites") : (zh ? "收藏图标组" : "Favorite icon group")} aria-pressed={Boolean(result.favorite)} onClick={onToggleFavorite}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg>
      </button>
      <button type="button" disabled={actionBusy} data-busy={actionBusy || undefined} data-tooltip={zh ? "整组下载" : "Download group"} aria-label={zh ? "导出图标组" : "Export icon group"} onClick={onExport}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v3h16v-3" /></svg>
      </button>
      <button type="button" disabled={actionBusy || Boolean(result.favorite)} data-busy={actionBusy || undefined} data-tooltip={result.favorite ? (zh ? "请先取消整组收藏" : "Remove the group from favorites first") : (zh ? "整组回收" : "Recycle group")} aria-label={zh ? "删除图标组" : "Delete icon group"} onClick={onDelete}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
      </button>
    </div> : null}
    <div className={css.groupMeta}>
      <p className={css.summary} title={result.plan.summary}>{result.plan.fallback ? (zh ? "已按通用交互场景整理 20 组图标。" : "Using 20 common UI icons.") : result.plan.summary}</p>
    </div>
    <div className={css.grid} data-canvas-pan-surface aria-busy={!result.saved && complete + failed < result.plan.count}>{result.plan.subjects.map(subject => { const item = items[subject.id] ?? (result.icons?.[subject.id] ? { status: "completed" as const, svg: result.icons[subject.id] } : undefined); const recycled = (result.recycledIconIds ?? []).includes(subject.id); if (recycled) return <article className={css.iconSpacer} key={subject.id} aria-hidden="true" />; return <article key={subject.id} data-icon-item={item?.svg ? "" : undefined} data-subject-id={subject.id} data-selected={selectedIconId === subject.id || undefined} onClick={event => { if (tool === "select" && item?.svg) { event.stopPropagation(); onSelectIcon(subject.id); onFocus(event.currentTarget); } }} onDoubleClick={event => { if (!item?.svg) return; event.preventDefault(); event.stopPropagation(); onSelectIcon(subject.id); onFocus(event.currentTarget); }}>
      {singleSelectionId === subject.id ? <div className={`${css.groupActions} ${css.iconActions}`} data-canvas-controls data-canvas-pan-surface data-icon-group-actions onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <button type="button" disabled={actionBusy} data-busy={actionBusy || undefined} data-tooltip={zh ? "单图收藏" : "Favorite icon"} aria-label={result.favoriteIconIds?.includes(singleSelectionId) ? (zh ? "取消收藏单图" : "Remove icon from favorites") : (zh ? "收藏单图" : "Favorite icon")} aria-pressed={Boolean(result.favoriteIconIds?.includes(singleSelectionId))} onClick={() => onToggleIconFavorite(singleSelectionId)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg>
      </button>
      <button type="button" disabled={actionBusy} data-busy={actionBusy || undefined} data-tooltip={zh ? "单图下载" : "Download icon"} aria-label={zh ? "下载单图" : "Download icon"} onClick={() => onExportIcon(singleSelectionId)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v3h16v-3" /></svg>
      </button>
      <button type="button" disabled={actionBusy || Boolean(result.favoriteIconIds?.includes(singleSelectionId))} data-busy={actionBusy || undefined} data-tooltip={result.favoriteIconIds?.includes(singleSelectionId) ? (zh ? "请先取消单图收藏" : "Remove the icon from favorites first") : (zh ? "单图回收" : "Recycle icon")} aria-label={zh ? "回收单图" : "Recycle icon"} onClick={() => onRecycleIcon(singleSelectionId)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
      </button>
    </div> : null}
      {item?.svg ? <button className={css.iconButton} data-canvas-controls aria-label={tool === "select" ? (zh ? `选中 ${subjectLabel(subject)}` : `Select ${subjectLabel(subject)}`) : subjectLabel(subject)} aria-pressed={tool === "select" ? selectedIconId === subject.id : undefined}><img src={imageUrl(themeDisplaySvg(item.svg, theme))} alt={subjectLabel(subject)} /></button> : isRetryable(subject) ? <button className={css.failedPreview} data-canvas-controls aria-label={zh ? `重试生成 ${subjectLabel(subject)}` : `Retry generating ${subjectLabel(subject)}`} onClick={() => retrySubject(subject)}>
        <span className={css.brokenImage} aria-hidden="true"><svg viewBox="0 0 48 48">
          <g className={css.leftFragment}><path d="M7 12h15l-4 9 6 6-5 11H7z"/><path d="m9 34 8-9 5 5"/></g>
          <g className={css.rightFragment}><path d="M28 12h13v26H21l5-11-6-6 5-9z"/><path d="m28 31 4-4 7 8"/></g>
        </svg></span>
        <span className={css.retryAction} aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M13 6a5.5 5.5 0 1 0 .1 3"/><path d="M10.5 3.5H13V6"/></svg></span>
      </button> : <span className={`${css.placeholder} ${!item || item.status === "queued" || item.status === "processing" ? css.loading : ""}`} aria-hidden="true" />}
      <span>{subjectLabel(subject)}</span>
      {item?.reviewStatus === "pending" || item?.reviewStatus === "rework-required" ? <button type="button" data-canvas-controls className={css.reviewNote} disabled={item.status === "processing"} aria-label={zh ? `继续复核 ${subjectLabel(subject)}` : `Continue review ${subjectLabel(subject)}`} onClick={event => { event.stopPropagation(); retrySubject(subject, true); }}>{item.status === "processing" ? (zh ? "复核中…" : "Reviewing…") : item.reviewStatus === "pending" ? (zh ? "继续复核" : "Continue review") : (zh ? "继续修形" : "Refine")}</button> : null}
    </article>; })}</div>
  </section>;
}
export function IconPlanResults({ results, zh, onBusyChange, actionBusyKeys, tool, scale, selectedGroupId, selectedIcon, raisedGroupId, positions, onSelectGroup, onSelectIcon, onIconGenerated, onRetryError, onMoveGroup, onMoveGroupEnd, onFocusGroup, onToggleFavorite, onToggleIconFavorite, onRecycleIcon, onExportGroup, onExportIcon, onDeleteGroup }: { results: PlanResult[]; busy: boolean; zh: boolean; onBusyChange: (id: string, busy: boolean) => void; actionBusyKeys: Set<string>; tool: CanvasTool; scale: number; selectedGroupId: string | null; selectedIcon: { groupId: string; subjectId: string } | null; raisedGroupId: string | null; positions: Record<string, GroupPosition>; onSelectGroup: (id: string) => void; onSelectIcon: (groupId: string, subjectId: string) => void; onIconGenerated: (groupId: string, subjectId: string, svg: string, context?: { reviewStatus?: string; [key: string]: unknown }) => void; onRetryError: () => void; onMoveGroup: (id: string, position: GroupPosition) => GroupPosition; onMoveGroupEnd: (id: string, position: GroupPosition) => void; onFocusGroup: (element: HTMLElement) => void; onToggleFavorite: (id: string) => void; onToggleIconFavorite: (groupId: string, subjectId: string) => void; onRecycleIcon: (groupId: string, subjectId: string) => void; onExportGroup: (id: string) => void; onExportIcon: (groupId: string, subjectId: string) => void; onDeleteGroup: (id: string) => void }) {
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
      return <PlanGroup key={result.id} result={result} zh={zh} onBusyChange={onBusyChange} actionBusy={actionBusyKeys.has(actionKey)} tool={tool} scale={scale} position={position} isSelected={selectedGroupId === result.id} selectedIconId={selectedSubjectId} isRaised={raisedGroupId === result.id} onSelect={() => onSelectGroup(result.id)} onSelectIcon={subjectId => onSelectIcon(result.id, subjectId)} onIconGenerated={(subjectId, svg, context) => onIconGenerated(result.id, subjectId, svg, context)} onRetryError={onRetryError} onMove={next => onMoveGroup(result.id, next)} onMoveEnd={next => onMoveGroupEnd(result.id, next)} onFocus={onFocusGroup} onToggleFavorite={() => onToggleFavorite(result.id)} onToggleIconFavorite={subjectId => onToggleIconFavorite(result.id, subjectId)} onRecycleIcon={subjectId => onRecycleIcon(result.id, subjectId)} onExport={() => onExportGroup(result.id)} onExportIcon={subjectId => onExportIcon(result.id, subjectId)} onDelete={() => onDeleteGroup(result.id)} />;
    })}
  </div>;
}
