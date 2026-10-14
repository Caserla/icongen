"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTheme } from "@/components/i18n/theme-switch";
import type { Appearance } from "@/features/library/core";
import { Toast } from "@/components/ui/toast";
import { previewPaletteFor } from "../preview-svg-palette";
import type { ManualPreviewColor } from "../manual-preview-color";
import css from "./canvas-composer.module.css";
import type { PlanResult } from "./icon-plan-results";
import { ICON_GENERATION_CATEGORIES } from "../icon-generation-categories";
import { generationErrorMessage } from "../generation-error-message";
import type { IntentResolution } from "../generation-intent";
import type { GenerationSnapshot } from "../generation-snapshot";
import { IntentResolutionDialog } from "./intent-resolution-dialog";
type GenerationDraft = { plan: PlanResult["plan"]; snapshot: GenerationSnapshot; needsResolution?: boolean };
const COMPOSER_DRAFT_SESSION_KEY = "icongen:generation-prompt-draft:v1";

export function CanvasComposer({ zh, projectId, projectName, projectDescription, styleId, lastSubcategoryId, previewSvg, onManualPreviewColorChange, onPlan, onPlanning, onStyleResolved }: { zh: boolean; projectId?: string; projectName?: string; projectDescription?: string; styleId: string; lastSubcategoryId: string; previewSvg: string; onManualPreviewColorChange?: (value: ManualPreviewColor | null) => void; onPlan?: (result: PlanResult) => void; onPlanning?: (busy: boolean) => void; onStyleResolved?: (styleId: string) => void }) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    // Restore only after hydration so server and client initially render the same textarea.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setText(sessionStorage.getItem(COMPOSER_DRAFT_SESSION_KEY) ?? ""); }
    catch { /* Browser storage can be unavailable. */ }
    setDraftRestored(true);
  }, []);
  useEffect(() => {
    if (!draftRestored) return;
    try { sessionStorage.setItem(COMPOSER_DRAFT_SESSION_KEY, text); }
    catch { /* Keep the editable draft in React state. */ }
  }, [draftRestored, text]);
  const [appearance, setAppearance] = useState<Appearance>({ size: 24, mode: "solid", color: "#3399DB", endColor: "#A78BFA", angle: 135 });
  const [colorSource, setColorSource] = useState("");
  const previousPalette = useRef<{ src: string; color: string } | null>(null);
  useLayoutEffect(() => {
    const colors = previewPaletteFor(previewSvg, theme === "dark");
    if (!colors) return;
    const previous = previousPalette.current;
    const styleChanged = previous?.src !== previewSvg;
    setAppearance(current => ({
      ...current,
      color: styleChanged || current.color.toLowerCase() === previous?.color.toLowerCase()
        ? colors.gradient?.start ?? colors.solid : current.color,
      endColor: colors.gradient?.end ?? current.endColor,
      mode: styleChanged ? colors.gradient?.mode ?? "solid" : current.mode,
      alpha: styleChanged ? (colors.alpha ?? 100) / 100 : current.alpha,
    }));
    previousPalette.current = { src: previewSvg, color: colors.solid };
    setColorSource(previewSvg);
  }, [previewSvg, theme]);
  useEffect(() => {
    onManualPreviewColorChange?.(colorSource === previewSvg
      ? { src: previewSvg, solid: appearance.color, alpha: Math.round((appearance.alpha ?? 1) * 100), gradient: appearance.mode !== "solid" ? { start: appearance.color, end: appearance.endColor, mode: appearance.mode } : undefined }
      : null);
  }, [colorSource, previewSvg, appearance, onManualPreviewColorChange]);
  const [notice, setNotice] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState<GenerationDraft | null>(null);
  const contextKey = projectId + ":" + lastSubcategoryId;
  const [lastContext, setLastContext] = useState(contextKey);
  if (lastContext !== contextKey) {
    setLastContext(contextKey);
    setPending(null);
  }
  const currentContext = useRef(contextKey);
  const requestAbort = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    currentContext.current = contextKey;
    requestAbort.current?.abort();
    return () => requestAbort.current?.abort();
  }, [contextKey]);
  async function saveDraft(draft: GenerationDraft, choice?: IntentResolution) {
    const capturedContext = currentContext.current;
    const saved = await fetch(`/api/projects/${draft.snapshot.projectId}/svg-sets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: draft.plan, snapshot: draft.snapshot, resolution: choice }), signal: requestAbort.current?.signal });
    const result = await saved.json();
    if (!saved.ok) throw new Error(result.message || (zh ? "图标集保存失败，请重试。" : "Couldn't save the icon set. Please retry."));
    if (!result.plan || !result.snapshot) throw new Error("Saved generation plan is missing");
    if (capturedContext !== currentContext.current) return;
    const snapshot = result.snapshot as GenerationSnapshot;
    setText(current => current.trim() === draft.snapshot.prompt?.trim() ? "" : current);
    onPlan?.({ id: result.id, plan: result.plan, snapshot });
    if (!snapshot.secondaryStyleId && snapshot.styleId !== lastSubcategoryId) onStyleResolved?.(snapshot.styleId);
  }
  async function chooseIntent(choice: IntentResolution) {
    if (!pending || submitting.current) return;
    const draft = pending;
    setPending(null); // Immediate response; save in the background.
    submitting.current = true; setBusy(true); onPlanning?.(true);
    requestAbort.current = new AbortController();
    try { await saveDraft(draft, choice); }
    catch (error) { if (!requestAbort.current.signal.aborted) { setPending(draft); setErrorMessage(generationErrorMessage(error, zh)); setNotice(Date.now()); } }
    finally { submitting.current = false; setBusy(false); onPlanning?.(false); }
  }
  async function submitPlan() {
    if (submitting.current || !text.trim()) return;
    if (!ICON_GENERATION_CATEGORIES.some(category => category.children.some(style => style.id === styleId))) {
      const message = zh ? "请先选择图标风格。" : "Select an icon style first.";
      setErrorMessage(message);
      setNotice(Date.now());
      return;
    }
    if (!projectId || !projectName?.trim()) {
      const message = zh ? "请先新增或关联项目。" : "Add or link a project first.";
      setErrorMessage(message);
      setNotice(Date.now());
      return;
    }
    submitting.current = true; setBusy(true); setNotice(0); setErrorMessage(""); onPlanning?.(true);
    const capturedContext = contextKey;
    const controller = new AbortController(); requestAbort.current = controller;
    try {
      const body = new FormData();
      const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
      const surface = getComputedStyle(input.current!).getPropertyValue("--canvas-surface").trim();
      body.set("input", JSON.stringify({ prompt: text, projectId, projectName, projectDescription, styleId, styleFamily: true, theme, targetSurface: /^#[0-9a-f]{6}$/i.test(surface) ? surface : undefined, locale: zh ? "zh" : "en", colors: { mode: "manual", locked: true, default: appearance.mode === "solid" ? { mode: "solid", color: appearance.color, alpha: Math.round((appearance.alpha ?? 1) * 100) } : appearance } }));
      let response: Response | null = null;
      let payload: { error?: { message?: string } | string; message?: string } & Partial<GenerationDraft> = {};
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch("/api/generation/icon-plan", { method: "POST", body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(85_000)]) });
        payload = await response.json().catch(() => ({}));
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
      }
      if (!response?.ok) {
        const code = typeof payload.error === "string" ? payload.error : "";
        const detail = typeof payload.error === "object" ? payload.error?.message : "";
        throw new Error(code === "SELECT_STYLE" ? (zh ? "请先选择图标风格。" : "Select an icon style first.") : detail || payload.message || (zh ? "解析失败，请重试。" : "Analysis failed. Please retry."));
      }
      if (!payload.plan || !payload.snapshot) throw new Error(zh ? "解析结果不完整，请重试。" : "The analysis result was incomplete. Please retry.");
      if (capturedContext !== currentContext.current || controller.signal.aborted) return;
      const draft: GenerationDraft = { plan: payload.plan, snapshot: payload.snapshot, needsResolution: payload.needsResolution };
      if (draft.needsResolution) { setPending(draft); return; }
      await saveDraft(draft);
    } catch (error) { if (!controller.signal.aborted) { setErrorMessage(generationErrorMessage(error, zh)); setNotice(Date.now()); } }
    finally { submitting.current = false; setBusy(false); onPlanning?.(false); }
  }
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "0px";
      const max = Math.min(240, window.innerHeight * 0.35);
      el.style.height = `${Math.max(44, Math.min(el.scrollHeight, max))}px`;
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    };
    resize();
    let width = el.parentElement!.clientWidth;
    const onResize = () => { const next = el.parentElement!.clientWidth; if (next !== width) { width = next; resize(); } };
    const observer = new ResizeObserver(onResize);
    observer.observe(el.parentElement!);
    window.addEventListener("resize", onResize);
    return () => { observer.disconnect(); window.removeEventListener("resize", onResize); };
  }, [text]);

  const quickPrompt = zh
    ? "分析当前项目相关信息，生成一套常用功能图标。"
    : "Analyze the current project and generate a set of common functional icons.";

  return <>
    <div className={css.composerDock} data-composer-dock data-canvas-controls>
    {quickPrompt ? <div className={css.quickPrompts} aria-label={zh ? "快速提示语" : "Quick prompts"}>
      <button type="button" title={quickPrompt} onClick={() => { setText(quickPrompt); requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(quickPrompt.length, quickPrompt.length); }); }}>{quickPrompt}</button>
    </div> : null}
    <form className={css.composer} data-canvas-glass onSubmit={event => {
      event.preventDefault();
      void submitPlan();
    }}>
      <textarea ref={input} value={text} rows={1} aria-label={zh ? "图标描述" : "Icon description"} placeholder={zh ? "您想更改或创建什么内容？" : "What would you like to change or create?"} onChange={event => setText(event.target.value)} />
      <div className={css.actions}>
        <div className={css.right}>
          <button className={css.send} type="submit" disabled={busy || !text.trim()} aria-label={busy ? (zh ? "正在分析需求" : "Analyzing request") : (zh ? "发送" : "Send")}><svg viewBox="0 0 24 24"><path d="M12 20V4m-6 6 6-6 6 6" /></svg></button>
        </div>
      </div>
    </form></div>
    {pending?.snapshot.designBrief && <IntentResolutionDialog brief={pending.snapshot.designBrief} zh={zh} onChoose={choice => { void chooseIntent(choice); }} onClose={() => { setPending(null); requestAnimationFrame(() => input.current?.focus()); }} />}
    {notice > 0 && errorMessage.trim() && <Toast key={notice} variant="error" message={errorMessage} />}
  </>;
}
