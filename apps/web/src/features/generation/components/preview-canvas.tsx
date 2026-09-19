"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import css from "./preview-canvas.module.css";
import { CanvasComposer } from "./canvas-composer";
import { ProjectThemePanel, ThemeMark } from "./project-theme-panel";
import { DEFAULT_PROJECT_THEME, type ProjectTheme } from "../project-themes";
import type { ManualPreviewColor } from "../manual-preview-color";
import { IconPlanResults, type PlanResult } from "./icon-plan-results";
import { Toast } from "@/components/ui/toast";
import { pendingGenerationId, updateActiveGenerationSets } from "../generation-busy";
import { mergeProjectSvgSetPage } from "../project-svg-set-pages";
import { alignMovingGroup } from "../canvas-alignment";
import { recycleGroupState, recycleIconState, setGroupFavorite, setIconFavorite } from "../project-icon-state";
import { FavoriteIconGroupsDialog } from "./favorite-icon-groups-dialog";
import { RecycleBinDialog } from "./recycle-bin-dialog";

const clamp = (value: number) => Math.min(300, Math.max(5, value));

export function PreviewCanvas({ children, zh, projectId, projectName, projectDescription, categoryId, previewSvg, theme = DEFAULT_PROJECT_THEME, aiTheme, customTheme, themeSource = "preset", onThemeSave, onManualPreviewColorChange, onGenerationBusyChange }: { children: ReactNode; zh: boolean; projectId?: string; projectName?: string; projectDescription?: string; categoryId: string; previewSvg: string; theme?: ProjectTheme; aiTheme?: ProjectTheme | null; customTheme?: ProjectTheme | null; themeSource?: string; onThemeSave?: (theme: ProjectTheme, choice: { source: "ai" | "manual" | "preset"; presetId?: string }) => void; onManualPreviewColorChange?: (value: ManualPreviewColor | null) => void; onGenerationBusyChange?: (busy: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [headerGlassRects, setHeaderGlassRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);
  const [plans, setPlans] = useState<PlanResult[]>([]);
  const [planning, setPlanning] = useState(false);
  const [activeSets, setActiveSets] = useState<Set<string>>(() => new Set());
  const onSetBusyChange = useCallback((id: string, busy: boolean) => {
    setActiveSets(current => updateActiveGenerationSets(current, id, busy));
  }, []);
  useEffect(() => { onGenerationBusyChange?.(planning || activeSets.size > 0); }, [planning, activeSets, onGenerationBusyChange]);
  const [loadError, setLoadError] = useState<{ id: number; message: string } | null>(null);
  const [positionError, setPositionError] = useState<{ id: number; message: string } | null>(null);
  const [groupActionError, setGroupActionError] = useState<{ id: number; message: string } | null>(null);
  const [groupPositions, setGroupPositions] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    void (async () => {
      let offset: number | null = 0;
      let asOf: string | null = null;
      while (offset !== null && !controller.signal.aborted) {
        const firstPage = offset === 0;
        const query = new URLSearchParams({ offset: String(offset) });
        if (asOf) query.set("asOf", asOf);
        try {
          const response = await fetch(`/api/projects/${projectId}/svg-sets?${query}`, { signal: controller.signal, cache: "no-store" });
          if (!response.ok) throw new Error("Project icon sets unavailable");
          const payload = await response.json() as { items: PlanResult[]; nextOffset: number | null; asOf: string };
          if (controller.signal.aborted) return;
          setGroupPositions(current => ({ ...current, ...Object.fromEntries(payload.items.map(item => [item.id, item.position ?? { x: 0, y: 0 }])) }));
          setPlans(current => mergeProjectSvgSetPage(current, projectId, payload.items, firstPage));
          setLoadError(null);
          asOf = payload.asOf;
          offset = payload.nextOffset;
        } catch {
          if (!controller.signal.aborted) setLoadError({ id: Date.now(), message: zh ? "项目图标集加载失败，请刷新重试。" : "Couldn't load project icons. Please refresh." });
          return;
        }
      }
    })();
    return () => controller.abort();
  }, [projectId, zh]);
  const menu = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const scale = zoom / 100;
  const zoomRef = useRef(100);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const [draft, setDraft] = useState("100");
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState<"select" | "hand" | "none">("select");
  const toolRef = useRef<"select" | "hand" | "none">("select");
  useEffect(() => { toolRef.current = tool; }, [tool]);
  const [themeOpen, setThemeOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [modifierLabel] = useState(() => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  useLayoutEffect(() => { panRef.current = pan; }, [pan]);
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>(".workspace-header");
    if (!header) return;
    const panes = Array.from(header.querySelectorAll<HTMLElement>(".workspace-header__brand-pane, .workspace-header__controls-pane"));
    const userMenuPanel = header.querySelector<HTMLElement>(".user-menu__panel");
    const update = () => setHeaderGlassRects([
      ...panes,
      ...(userMenuPanel?.dataset.open === "true" ? [userMenuPanel] : []),
    ].map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }));
    const observer = new ResizeObserver(update);
    panes.forEach(element => observer.observe(element));
    if (userMenuPanel) observer.observe(userMenuPanel);
    const menuObserver = userMenuPanel
      ? new MutationObserver(update)
      : null;
    if (userMenuPanel) menuObserver?.observe(userMenuPanel, { attributes: true, attributeFilter: ["data-open"] });
    window.addEventListener("resize", update);
    header.addEventListener("animationend", update);
    update();
    return () => {
      observer.disconnect();
      menuObserver?.disconnect();
      window.removeEventListener("resize", update);
      header.removeEventListener("animationend", update);
    };
  }, []);
  const [focusing, setFocusing] = useState(false);
  const focusAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<{ groupId: string; subjectId: string } | null>(null);
  const [raisedGroupId, setRaisedGroupId] = useState<string | null>(null);
  const [actionBusyKeys, setActionBusyKeys] = useState<Set<string>>(() => new Set());
  const actionBusyRef = useRef<Set<string>>(new Set());
  const beginAction = useCallback((key: string) => {
    if (actionBusyRef.current.has(key)) return false;
    actionBusyRef.current.add(key); setActionBusyKeys(new Set(actionBusyRef.current)); return true;
  }, []);
  const endAction = useCallback((key: string) => {
    actionBusyRef.current.delete(key); setActionBusyKeys(new Set(actionBusyRef.current));
  }, []);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number; y?: number }>({});
  useEffect(() => {
    if (tool === "select") return;
    const frame = requestAnimationFrame(() => { setSelectedGroupId(null); setSelectedIcon(null); });
    return () => cancelAnimationFrame(frame);
  }, [tool]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSelectedIcon(null));
    return () => cancelAnimationFrame(frame);
  }, [projectId]);
  const saveGroupPosition = useCallback(async (id: string, position: { x: number; y: number }) => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/svg-sets/${id}/position`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(position) });
      if (!response.ok) throw new Error("Position save failed");
      setPlans(current => current.map(item => item.id === id ? { ...item, position } : item));
    } catch {
      setPositionError({ id: Date.now(), message: zh ? "图标组位置保存失败，请重试。" : "Couldn't save the icon group position. Please retry." });
    }
  }, [projectId, zh]);
  const moveGroupWithSnap = useCallback((id: string, proposed: { x: number; y: number }) => {
    const canvas = root.current;
    const moving = canvas?.querySelector<HTMLElement>(`[data-canvas-icon-group][data-group-id="${id}"]`);
    if (!canvas || !moving) {
      setGroupPositions(current => ({ ...current, [id]: proposed }));
      return proposed;
    }
    const canvasRect = canvas.getBoundingClientRect();
    const movingRect = moving.getBoundingClientRect();
    const saved = plans.find(item => item.id === id)?.position ?? { x: 0, y: 0 };
    const current = groupPositions[id] ?? saved;
    const others = Array.from(canvas.querySelectorAll<HTMLElement>("[data-canvas-icon-group]"))
      .filter(other => other.dataset.groupId !== id)
      .map(other => other.getBoundingClientRect());
    const { position: resolved, guides } = alignMovingGroup({ proposed, current, moving: movingRect, others, canvas: canvasRect, scale });
    setAlignmentGuides(guides);
    setGroupPositions(positions => ({ ...positions, [id]: resolved }));
    return resolved;
  }, [groupPositions, plans, scale]);
  const toggleGroupFavorite = useCallback(async (id: string) => {
    if (!projectId) return;
    const actionKey = `group:${id}`;
    if (!beginAction(actionKey)) return;
    const current = plans.find(item => item.id === id);
    if (!current) { endAction(actionKey); return; }
    const favorite = !current.favorite;
    setPlans(items => setGroupFavorite(items, id, favorite));
    try {
      const response = await fetch(`/api/projects/${projectId}/svg-sets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite }) });
      if (!response.ok) throw new Error("Favorite update failed");
    } catch {
      setPlans(items => setGroupFavorite(items, id, !favorite));
      setGroupActionError({ id: Date.now(), message: zh ? "收藏状态更新失败，请重试。" : "Couldn't update the favorite. Please retry." });
    } finally { endAction(actionKey); }
  }, [beginAction, endAction, plans, projectId, zh]);
  const toggleIconFavorite = useCallback(async (groupId: string, subjectId: string) => {
    if (!projectId) return;
    const actionKey = `icon:${groupId}:${subjectId}`;
    if (!beginAction(actionKey)) return;
    const group = plans.find(item => item.id === groupId);
    if (!group?.icons?.[subjectId]) { endAction(actionKey); return; }
    const favorite = !(group.favoriteIconIds ?? []).includes(subjectId);
    setPlans(items => setIconFavorite(items, groupId, subjectId, favorite));
    try {
      const response = await fetch(`/api/projects/${projectId}/svg-sets/${groupId}/icons/${encodeURIComponent(subjectId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite }) });
      if (!response.ok) throw new Error("Icon favorite update failed");
    } catch {
      setPlans(items => setIconFavorite(items, groupId, subjectId, !favorite));
      setGroupActionError({ id: Date.now(), message: zh ? "单图收藏状态更新失败，请重试。" : "Couldn't update the icon favorite. Please retry." });
    } finally { endAction(actionKey); }
  }, [beginAction, endAction, plans, projectId, zh]);
  const exportGroup = useCallback((id: string) => {
    if (!projectId) return;
    const anchor = document.createElement("a");
    anchor.href = `/api/projects/${projectId}/svg-sets/${id}/download`;
    anchor.download = "";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }, [projectId]);
  const recycleGroup = useCallback(async (id: string) => {
    if (!projectId) return;
    const actionKey = `group:${id}`;
    if (!beginAction(actionKey)) return;
    const removed = plans.find(item => item.id === id);
    if (!removed) { endAction(actionKey); return; }
    const rect = root.current?.querySelector<HTMLElement>(`[data-canvas-icon-group][data-group-id="${id}"]`)?.getBoundingClientRect();
    const layoutSize = rect ? { width: rect.width / (zoomRef.current / 100), height: rect.height / (zoomRef.current / 100) } : removed.layoutSize;
    setPlans(items => recycleGroupState(items, id, layoutSize));
    setSelectedGroupId(current => current === id ? null : current);
    setSelectedIcon(current => current?.groupId === id ? null : current);
    setRaisedGroupId(current => current === id ? null : current);
    try {
      const response = await fetch(`/api/projects/${projectId}/svg-sets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recycled: true }) });
      if (!response.ok) throw new Error("Recycle failed");
    } catch {
      setPlans(items => items.map(item => item.id === id ? removed : item));
      setGroupActionError({ id: Date.now(), message: zh ? "图标组回收失败，请重试。" : "Couldn't recycle the icon group. Please retry." });
    } finally { endAction(actionKey); }
  }, [beginAction, endAction, plans, projectId, zh]);
  const recycleIcon = useCallback(async (groupId: string, subjectId: string) => {
    if (!projectId) return;
    const actionKey = `icon:${groupId}:${subjectId}`;
    if (!beginAction(actionKey)) return;
    const group = plans.find(item => item.id === groupId);
    if (!group) { endAction(actionKey); return; }
    const visibleCount = group?.plan.subjects.filter(subject => !(group.recycledIconIds ?? []).includes(subject.id)).length ?? 0;
    setPlans(items => recycleIconState(items, groupId, subjectId));
    setSelectedIcon(current => current?.groupId === groupId && current.subjectId === subjectId ? null : current);
    if (visibleCount <= 1) setSelectedGroupId(current => current === groupId ? null : current);
    try {
      const response = await fetch(`/api/projects/${projectId}/svg-sets/${groupId}/icons/${encodeURIComponent(subjectId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recycled: true }) });
      if (!response.ok) throw new Error("Recycle failed");
    } catch {
      setPlans(items => items.map(item => item.id === groupId ? group : item));
      setGroupActionError({ id: Date.now(), message: zh ? "单图回收失败，请重试。" : "Couldn't recycle the icon. Please retry." });
    } finally { endAction(actionKey); }
  }, [beginAction, endAction, plans, projectId, zh]);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const handDoubleClick = useRef<{ groupId: string; subjectId?: string; groupTarget: HTMLElement; iconTarget?: HTMLElement; at: number; x: number; y: number } | null>(null);
  const stopDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const changeZoom = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.round(clamp(value));
    setZoom(next);
    setDraft(String(next));
  }, []);
  const fit = useCallback(() => {
    const el = root.current;
    if (el) {
      const rail = parseFloat(getComputedStyle(el).getPropertyValue("--rail-offset")) || 0;
      changeZoom(Math.min((el.clientWidth - rail - 120) / 360, (el.clientHeight - 140) / 360) * 100);
      setPan({ x: 0, y: 0 });
    }
  }, [changeZoom]);
  const focusGroup = useCallback((element: HTMLElement) => {
    const el = root.current;
    if (!el) return;
    const viewportRect = el.getBoundingClientRect();
    const targetRect = element.getBoundingClientRect();
    const isSingleIcon = element.hasAttribute("data-icon-item");
    const rail = parseFloat(getComputedStyle(el).getPropertyValue("--rail-offset")) || 0;
    const toolsRect = el.querySelector<HTMLElement>("[data-canvas-tool-rail]")?.getBoundingClientRect();
    const horizontalGap = 24;
    const availableLeft = viewportRect.left + rail + horizontalGap;
    const availableRight = (toolsRect?.left ?? viewportRect.right - 64) - horizontalGap;
    const canvasCenter = {
      x: (availableLeft + availableRight) / 2,
      y: toolsRect ? toolsRect.top + toolsRect.height / 2 : viewportRect.top + el.clientHeight / 2,
    };
    const groupCenter = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
    const currentScale = zoomRef.current / 100;
    const transformOrigin = {
      x: viewportRect.left + (el.clientWidth + rail) / 2,
      y: viewportRect.top + (el.clientHeight + 80) / 2,
    };
    const worldOffset = {
      x: (groupCenter.x - transformOrigin.x - panRef.current.x) / currentScale,
      y: (groupCenter.y - transformOrigin.y - panRef.current.y) / currentScale,
    };
    const minimumFocusScale = isSingleIcon ? 1.2 : 0.8;
    const nextZoom = Math.round(clamp(Math.max(currentScale, minimumFocusScale) * 100));
    const nextScale = nextZoom / 100;
    if (focusAnimationTimer.current) clearTimeout(focusAnimationTimer.current);
    setFocusing(true);
    requestAnimationFrame(() => {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      setDraft(String(nextZoom));
      setPan({ x: canvasCenter.x - transformOrigin.x - worldOffset.x * nextScale, y: canvasCenter.y - transformOrigin.y - worldOffset.y * nextScale });
      focusAnimationTimer.current = setTimeout(() => setFocusing(false), 380);
    });
  }, []);
  useEffect(() => () => { if (focusAnimationTimer.current) clearTimeout(focusAnimationTimer.current); }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let gestureStartZoom: number | null = null;
    const isControl = (target: EventTarget | null) => target instanceof Element
      && !target.closest("[data-canvas-pan-surface]")
      && Boolean(target.closest("input, textarea, [data-canvas-controls], [contenteditable=true]"));
    const zoomAt = (value: number, clientX: number, clientY: number) => {
      const previous = zoomRef.current;
      const next = clamp(value);
      const ratio = next / previous;
      const rect = el.getBoundingClientRect();
      const rail = parseFloat(getComputedStyle(el).getPropertyValue("--rail-offset")) || 0;
      const x = clientX - rect.left - (el.clientWidth + rail) / 2;
      const y = clientY - rect.top - (el.clientHeight + 80) / 2;
      setPan(p => ({ x: x - (x - p.x) * ratio, y: y - (y - p.y) * ratio }));
      zoomRef.current = next;
      setZoom(next);
      setDraft(String(Math.round(next)));
    };
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest("dialog[open]")) return;
      if (toolRef.current !== "hand" && isControl(event.target)) return;
      event.preventDefault();
      setFocusing(false);
      if (gestureStartZoom !== null) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
      const delta = event.deltaY * unit;
      if (!(event.metaKey || event.ctrlKey)) {
        setPan(previous => ({ x: previous.x - event.deltaX * unit, y: previous.y - delta }));
        return;
      }
      // Chromium delivers trackpad pinch as a ctrl+wheel event.
      zoomAt(zoomRef.current * Math.exp(-delta * 0.004), event.clientX, event.clientY);
    };
    // Safari/WebKit exposes native trackpad pinch through gesture events.
    type PinchEvent = Event & { scale: number; clientX: number; clientY: number };
    const gestureStart = (event: Event) => {
      if (toolRef.current !== "hand" && isControl(event.target)) return;
      event.preventDefault();
      setFocusing(false);
      gestureStartZoom = zoomRef.current;
    };
    const gestureChange = (event: Event) => {
      if (gestureStartZoom === null) return;
      event.preventDefault();
      const pinch = event as PinchEvent;
      if (Number.isFinite(pinch.scale) && pinch.scale > 0) zoomAt(gestureStartZoom * pinch.scale, pinch.clientX, pinch.clientY);
    };
    const gestureEnd = (event: Event) => {
      if (gestureStartZoom === null) return;
      event.preventDefault();
      gestureStartZoom = null;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", gestureStart, { passive: false });
    el.addEventListener("gesturechange", gestureChange, { passive: false });
    el.addEventListener("gestureend", gestureEnd, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", gestureStart);
      el.removeEventListener("gesturechange", gestureChange);
      el.removeEventListener("gestureend", gestureEnd);
    };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element).closest("input, textarea, [contenteditable=true]")) return;
      if (!event.isComposing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        if (event.target instanceof HTMLElement && event.target.closest(".studio-header")) event.target.blur();
        setThemeOpen(false);
        setOpen(false);
        setTool("hand");
        return;
      }
      if (event.key === "Escape") { setOpen(false); setThemeOpen(false); }
      if ((event.metaKey || event.ctrlKey) && ["=", "+", "-"].includes(event.key)) {
        event.preventDefault();
        changeZoom(zoom + (event.key === "-" ? -10 : 10));
      } else if (event.shiftKey && event.code === "Digit0") {
        event.preventDefault(); changeZoom(100);
      } else if (event.shiftKey && event.code === "Digit1") {
        event.preventDefault(); fit();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [zoom, changeZoom, fit]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const spacing = Math.max(4, 22 * scale);
  const projectGroups = useMemo(() => plans.filter(item => projectId && (item.snapshot as { projectId?: string })?.projectId === projectId), [plans, projectId]);
  const arrangeGroups = () => {
    const canvas = root.current;
    if (!canvas || !projectId) return;
    const nodes = Array.from(canvas.querySelectorAll<HTMLElement>("[data-canvas-icon-group]"));
    if (!nodes.length) return;
    const gap = 24;
    const entries = nodes.map(element => {
      const id = element.dataset.groupId ?? "";
      const rect = element.getBoundingClientRect();
      const current = groupPositions[id] ?? projectGroups.find(item => item.id === id)?.position ?? { x: 0, y: 0 };
      return { id, rect, current, width: rect.width / scale, height: rect.height / scale };
    }).filter(item => item.id).sort((a, b) => b.width * b.height - a.width * a.height);
    const canvasRect = canvas.getBoundingClientRect();
    const resultsRect = canvas.querySelector<HTMLElement>("[data-icon-plan-results]")?.getBoundingClientRect();
    const rail = parseFloat(getComputedStyle(canvas).getPropertyValue("--rail-offset")) || 0;
    const toolsRect = canvas.querySelector<HTMLElement>("[data-canvas-tool-rail]")?.getBoundingClientRect();
    const availableLeft = canvasRect.left + rail + 24;
    const availableRight = (toolsRect?.left ?? canvasRect.right - 64) - 24;
    const totalArea = entries.reduce((sum, item) => sum + item.width * item.height, 0);
    const widestGroup = Math.max(...entries.map(item => item.width));
    const availableWorldWidth = Math.max(widestGroup, (availableRight - availableLeft) / scale);
    const targetRowWidth = Math.max(widestGroup, Math.min(Math.sqrt(totalArea * 1.6), availableWorldWidth));
    const packed: Array<(typeof entries)[number] & { x: number; y: number }> = [];
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;
    let packedWidth = 0;
    entries.forEach(item => {
      if (cursorX > 0 && cursorX + item.width > targetRowWidth) {
        cursorX = 0;
        cursorY += rowHeight + gap;
        rowHeight = 0;
      }
      packed.push({ ...item, x: cursorX, y: cursorY });
      cursorX += item.width + gap;
      rowHeight = Math.max(rowHeight, item.height);
      packedWidth = Math.max(packedWidth, cursorX - gap);
    });
    const packedHeight = cursorY + rowHeight;
    // The results container is fixed directly below the preview in canvas-world
    // coordinates. Use it as the arrangement anchor so panning never changes
    // where arranged groups are saved.
    const targetLeft = resultsRect
      ? (resultsRect.left + resultsRect.right - packedWidth * scale) / 2
      : (availableLeft + availableRight - packedWidth * scale) / 2;
    const targetTop = resultsRect?.top ?? canvasRect.top + canvasRect.height / 2 + 200 * scale;
    const nextPositions = Object.fromEntries(packed.map(item => [item.id, {
      x: item.current.x + (targetLeft + item.x * scale - item.rect.left) / scale,
      y: item.current.y + (targetTop + item.y * scale - item.rect.top) / scale,
    }]));
    setAlignmentGuides({});
    setGroupPositions(current => ({ ...current, ...nextPositions }));
    setPlans(items => items.map(item => nextPositions[item.id] ? { ...item, position: nextPositions[item.id] } : item));
    const focusCenter = {
      x: (availableLeft + availableRight) / 2,
      y: toolsRect ? toolsRect.top + toolsRect.height / 2 : canvasRect.top + canvas.clientHeight / 2,
    };
    const arrangedCenter = {
      x: targetLeft + packedWidth * scale / 2,
      y: targetTop + packedHeight * scale / 2,
    };
    if (focusAnimationTimer.current) clearTimeout(focusAnimationTimer.current);
    setFocusing(true);
    setPan(current => ({
      x: current.x + focusCenter.x - arrangedCenter.x,
      y: current.y + focusCenter.y - arrangedCenter.y,
    }));
    focusAnimationTimer.current = setTimeout(() => setFocusing(false), 380);
    void Promise.all(Object.entries(nextPositions).map(async ([id, position]) => {
      const response = await fetch(`/api/projects/${projectId}/svg-sets/${id}/position`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(position) });
      if (!response.ok) throw new Error("Position save failed");
    })).catch(() => setPositionError({ id: Date.now(), message: zh ? "自动整理已显示，但部分位置保存失败，请重试。" : "Groups were arranged, but some positions couldn't be saved." }));
  };
  const locateGroup = (id: string) => {
    setFavoritesOpen(false);
    setTool("select");
    setSelectedGroupId(id);
    setSelectedIcon(null);
    setRaisedGroupId(id);
    requestAnimationFrame(() => {
      const element = root.current?.querySelector<HTMLElement>(`[data-canvas-icon-group][data-group-id="${id}"]`);
      if (element) focusGroup(element);
    });
  };
  // Panning only changes the artwork transform; it must not rebuild every SVG card.
  const iconResults = useMemo(() => <IconPlanResults results={projectGroups} busy={planning} zh={zh} onBusyChange={onSetBusyChange} actionBusyKeys={actionBusyKeys} tool={tool} scale={scale} selectedGroupId={selectedGroupId} selectedIcon={selectedIcon} raisedGroupId={raisedGroupId} positions={groupPositions} onSelectGroup={id => { setTool("select"); setSelectedGroupId(id); setSelectedIcon(null); setRaisedGroupId(id); }} onSelectIcon={(groupId, subjectId) => { setTool("select"); setSelectedGroupId(null); setSelectedIcon({ groupId, subjectId }); setRaisedGroupId(groupId); }} onIconGenerated={(groupId, subjectId, svg) => setPlans(items => items.map(item => item.id === groupId ? { ...item, icons: { ...(item.icons ?? {}), [subjectId]: svg } } : item))} onRetryError={() => setGroupActionError({ id: Date.now(), message: zh ? "图标重试生成失败，请稍后再试。" : "The icon couldn't be regenerated. Please try again." })} onMoveGroup={moveGroupWithSnap} onMoveGroupEnd={(id, position) => { setAlignmentGuides({}); void saveGroupPosition(id, position); }} onFocusGroup={focusGroup} onToggleFavorite={id => void toggleGroupFavorite(id)} onToggleIconFavorite={(groupId, subjectId) => void toggleIconFavorite(groupId, subjectId)} onRecycleIcon={(groupId, subjectId) => void recycleIcon(groupId, subjectId)} onExportGroup={exportGroup} onDeleteGroup={id => void recycleGroup(id)} />,
  [projectGroups, planning, zh, onSetBusyChange, actionBusyKeys, tool, scale, selectedGroupId, selectedIcon, raisedGroupId, groupPositions, moveGroupWithSnap, saveGroupPosition, focusGroup, toggleGroupFavorite, toggleIconFavorite, recycleIcon, exportGroup, recycleGroup]);
  return <div ref={root} className={css.viewport} data-preview-canvas data-zoom={Math.round(zoom)}
    data-tool={tool} data-dragging={dragging} data-focusing={focusing || undefined} data-pan-x={pan.x} data-pan-y={pan.y}
    style={{ "--dot-spacing": `${spacing}px`, "--dot-radius": `${Math.max(0.45, 1.05 * scale)}px`, "--zoom": scale, "--pan-x": `${pan.x}px`, "--pan-y": `${pan.y}px` } as CSSProperties}
    onPointerDown={event => {
      setFocusing(false);
      const target = event.target as Element;
      const visualTarget = document.elementFromPoint(event.clientX, event.clientY) ?? target;
      if (tool === "select" && !target.closest("[data-canvas-icon-group], [data-canvas-controls]")) { setSelectedGroupId(null); setSelectedIcon(null); }
      const blockingControl = visualTarget.closest("[data-canvas-controls]") && !visualTarget.closest("[data-canvas-pan-surface]");
      if (tool !== "hand" || event.button !== 0 || !event.isPrimary || blockingControl) return;
      const groupTarget = visualTarget.closest<HTMLElement>("[data-canvas-icon-group]");
      const iconTarget = visualTarget.closest<HTMLElement>("[data-icon-item][data-subject-id]");
      const groupId = groupTarget?.dataset.groupId;
      const subjectId = iconTarget?.dataset.subjectId;
      const now = performance.now();
      const previous = handDoubleClick.current;
      const repeatedPress = previous
        && now - previous.at <= 650
        && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 12;
      if (repeatedPress) {
        handDoubleClick.current = null;
        event.preventDefault();
        event.stopPropagation();
        stopDrag();
        setTool("select");
        setRaisedGroupId(previous.groupId);
        if (previous.iconTarget && previous.subjectId) { setSelectedGroupId(null); setSelectedIcon({ groupId: previous.groupId, subjectId: previous.subjectId }); }
        else { setSelectedGroupId(previous.groupId); setSelectedIcon(null); }
        requestAnimationFrame(() => focusGroup(previous.iconTarget ?? previous.groupTarget));
        return;
      }
      if (groupTarget && groupId) {
        handDoubleClick.current = { groupId, subjectId, groupTarget, iconTarget: iconTarget ?? undefined, at: now, x: event.clientX, y: event.clientY };
      } else handDoubleClick.current = null;
      event.preventDefault();
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }}
    onPointerMove={event => {
      const active = drag.current;
      if (active?.id === event.pointerId) {
        if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 4) handDoubleClick.current = null;
        setPan({ x: active.originX + event.clientX - active.x, y: active.originY + event.clientY - active.y });
      }
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
    }}
    onPointerUp={event => {
      if (drag.current?.id !== event.pointerId) return;
      stopDrag();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={stopDrag}
    onLostPointerCapture={stopDrag}
    onClickCapture={event => {
      if (tool === "hand" && (event.target as Element).closest("[data-canvas-pan-surface]")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
    <div className={css.dots} aria-hidden="true" />
    <div className={css.highlight} aria-hidden="true" />
    <div className={css.artwork}>{children}{iconResults}</div>
    {headerGlassRects.map((rect, index) => <span
      key={index}
      className={css.headerGlassBackdrop}
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      aria-hidden="true"
    />)}
    {alignmentGuides.x !== undefined ? <span className={`${css.alignmentGuide} ${css.verticalGuide}`} style={{ left: alignmentGuides.x }} aria-hidden="true" /> : null}
    {alignmentGuides.y !== undefined ? <span className={`${css.alignmentGuide} ${css.horizontalGuide}`} style={{ top: alignmentGuides.y }} aria-hidden="true" /> : null}
    {loadError ? <Toast key={loadError.id} message={loadError.message} variant="error" /> : null}
    {positionError ? <Toast key={positionError.id} message={positionError.message} variant="error" /> : null}
    {groupActionError ? <Toast key={groupActionError.id} message={groupActionError.message} variant="error" /> : null}
    <CanvasComposer zh={zh} projectId={projectId} projectName={projectName} projectDescription={projectDescription} categoryId={categoryId} previewSvg={previewSvg} projectTheme={theme} onManualPreviewColorChange={onManualPreviewColorChange} onPlan={plan => { setActiveSets(current => new Set(current).add(pendingGenerationId(plan.id))); setPlans(current => current.some(item => item.id === plan.id) ? current : [...current, plan]); }} onPlanning={setPlanning} />
    <ProjectThemePanel open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme} aiTheme={aiTheme} customTheme={customTheme} themeSource={themeSource} onSave={(next, choice) => onThemeSave?.(next, choice)} zh={zh} />
    <FavoriteIconGroupsDialog open={favoritesOpen} projectGroups={projectGroups} zh={zh} onClose={() => setFavoritesOpen(false)} onLocate={locateGroup} onExport={exportGroup} onRemove={id => void toggleGroupFavorite(id)} onRemoveIcon={(groupId, subjectId) => void toggleIconFavorite(groupId, subjectId)} />
    <RecycleBinDialog open={recycleBinOpen} projectId={projectId} zh={zh} onClose={() => setRecycleBinOpen(false)} onRestored={({ groupId, subjectId, svg, icons }) => {
      setPlans(items => items.map(item => {
        if (item.id !== groupId) return item;
        if (subjectId) return {
          ...item,
          recycledIconIds: (item.recycledIconIds ?? []).filter(id => id !== subjectId),
          icons: svg ? { ...(item.icons ?? {}), [subjectId]: svg } : item.icons,
        };
        return { ...item, recycled: false, icons: icons ? { ...(item.icons ?? {}), ...icons } : item.icons };
      }));
      setRaisedGroupId(groupId);
      if (subjectId) {
        setSelectedGroupId(null);
        setSelectedIcon({ groupId, subjectId });
      } else {
        setSelectedIcon(null);
        setSelectedGroupId(groupId);
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const restoredGroup = root.current?.querySelector<HTMLElement>(`[data-canvas-icon-group][data-group-id="${groupId}"]`);
        if (restoredGroup) focusGroup(restoredGroup);
      }));
    }} onDeleted={({ groupId, subjectId }) => {
      setPlans(items => items.flatMap(item => {
        if (item.id !== groupId) return [item];
        if (!subjectId) return [];
        const subjects = item.plan.subjects.filter(subject => subject.id !== subjectId);
        if (!subjects.length) return [];
        const icons = { ...(item.icons ?? {}) };
        delete icons[subjectId];
        return [{
          ...item,
          plan: { ...item.plan, subjects, count: subjects.length },
          icons,
          recycledIconIds: (item.recycledIconIds ?? []).filter(id => id !== subjectId),
          favoriteIconIds: (item.favoriteIconIds ?? []).filter(id => id !== subjectId),
        }];
      }));
      setSelectedGroupId(current => current === groupId ? null : current);
      setSelectedIcon(current => current?.groupId === groupId && (!subjectId || current.subjectId === subjectId) ? null : current);
      if (!subjectId) setGroupPositions(current => {
        const next = { ...current };
        delete next[groupId];
        return next;
      });
    }} />
    <div className={css.tools} role="toolbar" aria-label={zh ? "画布工具" : "Canvas tools"} data-canvas-tool-rail data-canvas-controls data-canvas-glass>
      <button className={css.themeButton} type="button" data-theme-trigger data-tooltip={zh ? "项目主题色" : "Project theme"} aria-label={zh ? "项目主题色" : "Project theme"} aria-expanded={themeOpen} onClick={() => { setOpen(false); setThemeOpen(value => { const next = !value; if (next) setTool("none"); return next; }); }}><ThemeMark theme={theme} /></button>
      <span className={css.toolDivider} aria-hidden="true" />
      <button type="button" data-tooltip={zh ? "选择" : "Select"} aria-label={zh ? "选择工具" : "Select tool"} aria-pressed={tool === "select"} onClick={() => { setThemeOpen(false); setOpen(false); setTool("select"); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m6 3 12 10-6 1-3 6Z"/><path d="m12 14 4 7"/></svg>
      </button>
      <button type="button" data-tooltip={zh ? "平移 - H" : "Pan - H"} aria-label={zh ? "手形工具" : "Hand tool"} aria-keyshortcuts="H" aria-pressed={tool === "hand"} onClick={() => { setThemeOpen(false); setOpen(false); setTool("hand"); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7c0 4-2.4 6-6 6-2.3 0-4-1-5.5-3L4 12a1.6 1.6 0 0 1 2.5-2Z"/></svg>
      </button>
      <span className={css.toolDivider} aria-hidden="true" />
      <button type="button" data-tooltip={zh ? "自动整理" : "Auto arrange"} aria-label={zh ? "自动整理画布" : "Auto arrange canvas"} disabled={!projectId || !projectGroups.some(item => !item.recycled)} onClick={() => { setThemeOpen(false); setOpen(false); setFavoritesOpen(false); setRecycleBinOpen(false); arrangeGroups(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="7" height="6" rx="1"/><rect x="14" y="4" width="7" height="6" rx="1"/><rect x="3" y="14" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/></svg>
      </button>
      <button type="button" data-tooltip={zh ? "收藏夹" : "Favorites"} aria-label={zh ? "打开收藏夹" : "Open favorites"} aria-expanded={favoritesOpen} onClick={() => { setThemeOpen(false); setOpen(false); setRecycleBinOpen(false); setFavoritesOpen(true); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84L6.6 19.6l1.03-6-4.36-4.25 6.03-.88Z" /></svg>
      </button>
      <button type="button" data-tooltip={zh ? "废纸篓" : "Recycle bin"} aria-label={zh ? "打开废纸篓" : "Open recycle bin"} aria-expanded={recycleBinOpen} onClick={() => { setThemeOpen(false); setOpen(false); setFavoritesOpen(false); setRecycleBinOpen(true); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>
      </button>
    </div>
    <div className={css.zoomControl} ref={menu} data-canvas-controls>
      {open && <div className={css.menu} data-canvas-glass aria-label={zh ? "缩放设置" : "Zoom settings"}>
        <form onSubmit={event => { event.preventDefault(); changeZoom(Number(draft)); setOpen(false); }}>
          <input aria-label={zh ? "缩放百分比" : "Zoom percentage"} type="number" min="5" max="300" value={draft} onChange={event => setDraft(event.target.value)} onFocus={event => event.currentTarget.select()} /><span>%</span>
        </form>
        <button type="button" disabled={zoom >= 300} onClick={() => changeZoom(zoom + 10)}><span>{zh ? "放大" : "Zoom in"}</span><kbd>{modifierLabel} +</kbd></button>
        <button type="button" disabled={zoom <= 5} onClick={() => changeZoom(zoom - 10)}><span>{zh ? "缩小" : "Zoom out"}</span><kbd>{modifierLabel} −</kbd></button>
        <button type="button" onClick={() => { changeZoom(100); setOpen(false); }}><span>{zh ? "缩放至 100%" : "Zoom to 100%"}</span><kbd>⇧ 0</kbd></button>
        <button type="button" onClick={() => { fit(); setOpen(false); }}><span>{zh ? "适应画布" : "Zoom to Fit"}</span><kbd>⇧ 1</kbd></button>
        <div className={css.presets}>{[5, 25, 50, 100, 200, 300].map(value => <button type="button" key={value} aria-pressed={Math.round(zoom) === value} onClick={() => { changeZoom(value); setOpen(false); }}>{value}%</button>)}</div>
      </div>}
      <button className={css.zoomButton} data-canvas-glass type="button" aria-expanded={open} aria-label={zh ? "画布缩放" : "Canvas zoom"} onClick={() => { setThemeOpen(false); setOpen(value => { const next = !value; if (next) setTool("none"); return next; }); }}>{Math.round(zoom)}%</button>
    </div>
  </div>;
}
