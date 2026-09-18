"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StudioColorPicker } from "./studio-color-picker";
import { LibraryColorPicker } from "@/features/library/library-color-picker";
import type { Appearance } from "@/features/library/core";
import { Toast } from "@/components/ui/toast";
import { previewPaletteFor } from "../preview-svg-palette";
import type { ManualPreviewColor } from "../manual-preview-color";
import css from "./canvas-composer.module.css";
import type { PlanResult } from "./icon-plan-results";
import type { ProjectTheme } from "../project-themes";

export function CanvasComposer({ zh, projectId, projectName, projectDescription, categoryId, previewSvg, projectTheme, onManualPreviewColorChange, onPlan, onPlanning }: { zh: boolean; projectId?: string; projectName?: string; projectDescription?: string; categoryId: string; previewSvg: string; projectTheme: ProjectTheme; onManualPreviewColorChange?: (value: ManualPreviewColor | null) => void; onPlan?: (result: PlanResult) => void; onPlanning?: (busy: boolean) => void }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState("#3399DB");
  const [colorAlpha, setColorAlpha] = useState(100);
  const [automaticColor, setAutomaticColor] = useState(true);
  const [gradientColor, setGradientColor] = useState<Appearance>({ size: 24, mode: "linear", color: "#3399DB", endColor: "#A78BFA", angle: 135 });
  const [colorSource, setColorSource] = useState("");
  const manualColorAvailable = categoryId !== "multicolor";
  const previewUsesGradient = Boolean(previewPaletteFor(previewSvg, false)?.gradient);
  const smartColor = automaticColor || !manualColorAvailable;
  const toggleColorMode = () => {
    if (!smartColor) onManualPreviewColorChange?.(null);
    setAutomaticColor(value => !value);
  };
  useEffect(() => {
    if (!manualColorAvailable) setAutomaticColor(true);
  }, [manualColorAvailable]);
  useLayoutEffect(() => {
    if (smartColor) { setColorSource(""); return; }
    setColorSource("");
    const colors = previewPaletteFor(previewSvg, window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (!colors) return;
    setColor(colors.solid);
    setColorAlpha(colors.alpha ?? 100);
    if (previewUsesGradient) setGradientColor(current => ({
      ...current,
      color: colors.gradient?.start ?? colors.solid,
      endColor: colors.gradient?.end ?? current.endColor,
      mode: colors.gradient?.mode ?? "linear",
    }));
    setColorSource(previewSvg);
  }, [smartColor, previewSvg, previewUsesGradient]);
  useEffect(() => {
    onManualPreviewColorChange?.(!smartColor && colorSource === previewSvg
      ? { src: previewSvg, solid: color, alpha: colorAlpha, gradient: previewUsesGradient ? { start: gradientColor.color, end: gradientColor.endColor, mode: gradientColor.mode === "radial" ? "radial" : "linear" } : undefined }
      : null);
  }, [smartColor, colorSource, previewSvg, color, colorAlpha, previewUsesGradient, gradientColor, onManualPreviewColorChange]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileError, setFileError] = useState(0);
  useEffect(() => {
    if (!file) { setPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const [notice, setNotice] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");
  async function submitPlan() {
    if (submitting.current || (!text.trim() && !file)) return;
    const styleId = previewSvg.split("/").pop()?.replace(/\.svg$/, "") ?? "";
    if (!previewSvg.includes("/style-subcategories/") || !styleId) {
      const message = zh ? "请先选择图标子风格。" : "Select an icon substyle first.";
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
    submitting.current = true; setBusy(true); setErrorMessage(""); onPlanning?.(true);
    try {
      const body = new FormData();
      const smartDefault = previewUsesGradient
        ? { mode: "linear", color: projectTheme.primary, endColor: projectTheme.secondary, angle: 135, alpha: 100 }
        : { mode: "solid", color: projectTheme.primary, alpha: 100 };
      body.set("input", JSON.stringify({ prompt: text, projectId, projectName, projectDescription, styleId, locale: zh ? "zh" : "en", colors: { mode: smartColor ? "smart" : "manual", locked: true, palette: projectTheme, default: smartColor ? smartDefault : previewUsesGradient ? gradientColor : { mode: "solid", color, alpha: colorAlpha }, selected: null } }));
      if (file) {
        let reference = file;
        if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
          const url = URL.createObjectURL(file);
          try {
            const image = new Image(); image.src = url; await image.decode();
            const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = Math.max(1, Math.round(1024 * image.naturalHeight / Math.max(1, image.naturalWidth)));
            if (canvas.height > 4096) throw new Error("参考图比例过大，请使用 PNG 或 WebP。");
            canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("参考图转换失败")), "image/png"));
            reference = new File([blob], "reference.png", { type: "image/png" });
          } finally { URL.revokeObjectURL(url); }
        }
        body.set("reference", reference);
      }
      setText("");
      let response: Response | null = null;
      let payload: { error?: { message?: string } | string; message?: string; plan?: PlanResult["plan"]; snapshot?: PlanResult["snapshot"] } = {};
      for (let attempt = 0; attempt < 2; attempt += 1) {
        response = await fetch("/api/generation/icon-plan", { method: "POST", body, signal: AbortSignal.timeout(85_000) });
        payload = await response.json().catch(() => ({}));
        if (response.ok || (response.status !== 429 && response.status < 500)) break;
      }
      if (!response?.ok) {
        const code = typeof payload.error === "string" ? payload.error : "";
        const detail = typeof payload.error === "object" ? payload.error?.message : "";
        throw new Error(code === "SELECT_SUBSTYLE" ? (zh ? "请先选择图标子风格。" : "Select an icon substyle first.") : detail || payload.message || (zh ? "解析失败，请重试。" : "Analysis failed. Please retry."));
      }
      if (!payload.plan || !payload.snapshot) throw new Error(zh ? "解析结果不完整，请重试。" : "The analysis result was incomplete. Please retry.");
      const saved = await fetch(`/api/projects/${projectId}/svg-sets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: payload.plan, snapshot: payload.snapshot }) });
      const savedPayload = await saved.json();
      if (!saved.ok) throw new Error(savedPayload.message || (zh ? "图标集保存失败，请重试。" : "Couldn't save the icon set. Please retry."));
      onPlan?.({ id: savedPayload.id, plan: payload.plan, snapshot: payload.snapshot });
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "解析失败，请重试。"); setNotice(Date.now()); }
    finally { submitting.current = false; setBusy(false); onPlanning?.(false); }
  }
  const input = useRef<HTMLTextAreaElement>(null);
  const attachment = useRef<HTMLInputElement>(null);
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
    <div className={css.composerDock} data-canvas-controls>
    {quickPrompt ? <div className={css.quickPrompts} aria-label={zh ? "快速提示语" : "Quick prompts"}>
      <button type="button" title={quickPrompt} onClick={() => { setText(quickPrompt); requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(quickPrompt.length, quickPrompt.length); }); }}>{quickPrompt}</button>
    </div> : null}
    <form className={css.composer} data-canvas-glass onSubmit={event => {
      event.preventDefault();
      void submitPlan();
    }}>
      {file && <div className={css.attachment}>{previewUrl && <img src={previewUrl} alt="" />}<span title={file.name}>{file.name}</span><button type="button" aria-label={zh ? "移除附件" : "Remove attachment"} onClick={() => { setFile(null); if (attachment.current) attachment.current.value = ""; }}>×</button></div>}
      <textarea ref={input} value={text} rows={1} aria-label={zh ? "图标描述" : "Icon description"} placeholder={zh ? "您想更改或创建什么内容？" : "What would you like to change or create?"} onChange={event => setText(event.target.value)} />
      <div className={css.actions}>
        <input ref={attachment} type="file" accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={event => {
          const selected = event.target.files?.[0];
          if (!selected) return;
          if (!/\.(png|jpe?g|svg|webp)$/i.test(selected.name) || (selected.type && !["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(selected.type))) {
            event.target.value = "";
            setFileError(Date.now());
            return;
          }
          setFileError(0);
          setFile(selected);
        }} />
        <button className={css.add} type="button" aria-label={zh ? "添加参考图片" : "Add reference image"} onClick={() => attachment.current?.click()}><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" /></svg></button>
        <div className={css.right}>
          <div className={css.generationMode}>
            <span className={css.modeState}>{smartColor ? (zh ? "智能配色" : "Smart colors") : (zh ? "手动配色" : "Manual colors")}</span>
            <button className={css.modeSwitch} type="button" role="switch" aria-checked={smartColor} aria-label={zh ? "智能配色" : "Smart colors"} title={!manualColorAvailable ? (zh ? "多色风格仅支持智能配色" : "Multicolor styles use smart colors only") : undefined} disabled={!manualColorAvailable} onClick={toggleColorMode}><span className={css.modeThumb} /></button>
          </div>
          <div className={css.colorSlot}>
            {!smartColor && (previewUsesGradient
              ? <div className={`${css.color} ${css.gradientColor}`}><LibraryColorPicker gradientOnly portal value={gradientColor} onChange={setGradientColor} zh={zh} /></div>
              : <div className={css.color}><StudioColorPicker value={color} onChange={setColor} alpha={colorAlpha} onAlphaChange={setColorAlpha} label={zh ? "选择颜色" : "Choose color"} locale={zh ? "zh" : "en"} /><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></div>)}
          </div>
          <button className={css.send} type="submit" disabled={busy || (!text.trim() && !file)} aria-label={busy ? (zh ? "正在分析需求" : "Analyzing request") : (zh ? "发送" : "Send")}><svg viewBox="0 0 24 24"><path d="M12 20V4m-6 6 6-6 6 6" /></svg></button>
        </div>
      </div>
    </form></div>
    {notice > 0 && <Toast key={notice} variant="error" message={errorMessage} />}
    {fileError > 0 && <Toast key={fileError} variant="error" message={zh ? "仅支持 PNG、JPG/JPEG、SVG、WebP 格式图片。" : "Only PNG, JPG/JPEG, SVG and WebP images are supported."} />}
  </>;
}
