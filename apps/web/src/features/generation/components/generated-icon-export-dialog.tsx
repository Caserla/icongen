"use client";

/* eslint-disable @next/next/no-img-element -- Generated SVG previews are local immutable data URLs. */
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Toast } from "@/components/ui/toast";
import { IconPreviewGrid } from "./icon-preview-grid";
import { codeTargets, exportCode, type CodeTarget } from "@/features/library/code-export";
import { defaultAppearance, exportBlob, saveBlob, svgDataUrl, type Appearance, type FileFormat } from "@/features/library/core";
import { LibraryColorPicker } from "@/features/library/library-color-picker";
import { SelectionPopover, useSelectionPopover } from "@/features/library/selection-popover";
import { applyMonochromeAppearance, isMonochromeStyle, monochromeSvgColor } from "../monochrome-svg";
import { ICON_GENERATION_CATEGORIES } from "../icon-generation-categories";
import { LIBRARY_GENERATION_LABELS, LIBRARY_GENERATION_STYLES, type LibraryGenerationStyle } from "../library-generation-styles";
import { themeDisplaySvg } from "../theme-display-svg";
import { useTheme } from "@/components/i18n/theme-switch";
import libraryCss from "@/features/library/library.module.css";
import css from "./generated-icon-export-dialog.module.css";

type StyleFamily = Record<LibraryGenerationStyle, string>;
export type GeneratedExportIcon = { id: string; groupId: string; groupName: string; name: string; svg: string; styleId: string; hasStyleFamily?: boolean; variants?: StyleFamily };

export function GeneratedIconExportDialog({ title, projectId, icons, allIcons, initialIconId, groupMode, zh, onClose }: { title: string; projectId?: string; icons: GeneratedExportIcon[]; allIcons: GeneratedExportIcon[]; initialIconId?: string; groupMode: boolean; zh: boolean; onClose: () => void }) {
  const theme = useTheme();
  const dialog = useRef<HTMLDialogElement>(null);
  const memberStrip = useRef<HTMLDivElement>(null);
  const memberDrag = useRef<{ pointerId: number; startX: number; scrollLeft: number; moved: boolean } | null>(null);
  const suppressMemberClick = useRef(false);
  const [activeId, setActiveId] = useState(initialIconId ?? icons[0]?.id ?? "");
  const [activeStyle, setActiveStyle] = useState<LibraryGenerationStyle>("linear");
  const [format, setFormat] = useState<FileFormat>("svg");
  const [size, setSize] = useState(128);
  const [codeTarget, setCodeTarget] = useState<CodeTarget>("SVG");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [appearanceOverrides, setAppearanceOverrides] = useState<Record<string, Appearance>>({});
  const [loadedFamilies, setLoadedFamilies] = useState<Record<string, StyleFamily>>({});
  const familyRequests = useRef(new Map<string, Promise<StyleFamily>>());
  const active = allIcons.find(icon => icon.id === activeId) ?? icons[0];
  const activeVariants = active?.variants ?? loadedFamilies[active?.id ?? ""];
  const selectedSvg = activeVariants?.[activeStyle] ?? (active?.hasStyleFamily && activeStyle !== "linear" ? "" : active?.svg ?? "");
  const selectedStyleId = active?.hasStyleFamily ? activeStyle : active?.styleId ?? "";
  const downloadIcons = groupMode ? allIcons.filter(icon => icon.groupId === active?.groupId) : active ? [active] : [];
  const activeIndex = allIcons.findIndex(icon => icon.id === active?.id);
  const groupIds = [...new Set(allIcons.map(icon => icon.groupId))];
  const activeGroupIndex = groupIds.indexOf(active?.groupId ?? "");
  const previousIcon = groupMode
    ? groupIds.length > 1 ? allIcons.find(icon => icon.groupId === groupIds[(activeGroupIndex - 1 + groupIds.length) % groupIds.length]) : undefined
    : allIcons.length > 1 ? allIcons[(activeIndex - 1 + allIcons.length) % allIcons.length] : undefined;
  const nextIcon = groupMode
    ? groupIds.length > 1 ? allIcons.find(icon => icon.groupId === groupIds[(activeGroupIndex + 1) % groupIds.length]) : undefined
    : allIcons.length > 1 ? allIcons[(activeIndex + 1) % allIcons.length] : undefined;
  const baseColor = active && isMonochromeStyle(selectedStyleId) ? monochromeSvgColor(selectedSvg) : null;
  const activeAppearance = active && baseColor ? appearanceOverrides[active.id] ?? { ...defaultAppearance, color: baseColor } : null;
  const activeSvg = active && baseColor && activeAppearance ? applyMonochromeAppearance(selectedSvg, baseColor, activeAppearance) : selectedSvg;
  const substyle = ICON_GENERATION_CATEGORIES.flatMap(category => category.children).find(item => item.id === selectedStyleId)?.label;
  const code = useMemo(() => exportCode(activeSvg, codeTarget), [activeSvg, codeTarget]);
  const loadFamily = async (icon: GeneratedExportIcon): Promise<StyleFamily | undefined> => {
    if (!icon.hasStyleFamily) return undefined;
    if (icon.variants) return icon.variants;
    if (loadedFamilies[icon.id]) return loadedFamilies[icon.id];
    const pending = familyRequests.current.get(icon.id);
    if (pending) return pending;
    if (!projectId) throw new Error("Missing project");
    const request = fetch(`/api/projects/${projectId}/svg-sets/${icon.groupId}/icons/${encodeURIComponent(icon.id.slice(icon.groupId.length + 1))}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Icon styles unavailable");
        const payload = await response.json() as { variants?: Record<string, string> };
        if (!payload.variants || !LIBRARY_GENERATION_STYLES.every(style => typeof payload.variants?.[style] === "string")) throw new Error("Incomplete icon styles");
        const variants = payload.variants as StyleFamily;
        setLoadedFamilies(current => ({ ...current, [icon.id]: variants }));
        return variants;
      }).finally(() => familyRequests.current.delete(icon.id));
    familyRequests.current.set(icon.id, request);
    return request;
  };
  useEffect(() => {
    if (!active?.hasStyleFamily || activeVariants) return;
    void loadFamily(active).catch(() => setMessage(zh ? "风格加载失败，点击下载可重试。" : "Styles failed to load. Download to retry."));
    // Only the active item changes which family we need; cached requests are deduplicated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, activeVariants, projectId]);
  const outputSvg = (icon: GeneratedExportIcon, variants?: StyleFamily) => {
    const variantSvg = variants?.[activeStyle] ?? icon.svg;
    const original = isMonochromeStyle(variants ? activeStyle : icon.styleId) ? monochromeSvgColor(variantSvg) : null;
    const appearance = appearanceOverrides[icon.id];
    return original && appearance ? applyMonochromeAppearance(variantSvg, original, appearance) : variantSvg;
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    node?.showModal(); node?.focus({ preventScroll: true }); document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const download = async () => {
    if (!downloadIcons.length || busy) return;
    setBusy(true);
    try {
      if (downloadIcons.length === 1) {
        const icon = downloadIcons[0];
        const variants = await loadFamily(icon);
        saveBlob(await exportBlob(outputSvg(icon, variants), format, size), `${icon.name || icon.id}${variants ? `-${activeStyle}` : ""}.${format}`);
      } else {
        const zip = new JSZip();
        for (let index = 0; index < downloadIcons.length; index++) {
          const icon = downloadIcons[index];
          const variants = await loadFamily(icon);
          zip.file(`${String(index + 1).padStart(2, "0")}-${icon.name || icon.id}${variants ? `-${activeStyle}` : ""}.${format}`, await exportBlob(outputSvg(icon, variants), format, size));
        }
        saveBlob(await zip.generateAsync({ type: "blob" }), `${active.groupName || title || "icon-group"}-${format}.zip`);
      }
    } catch { setMessage(zh ? "下载失败，请重试。" : "Download failed. Try again."); }
    finally { setBusy(false); }
  };
  const navigate = (icon: GeneratedExportIcon | undefined, button: HTMLButtonElement) => {
    if (!icon) return;
    window.getSelection()?.removeAllRanges();
    setActiveId(icon.id);
    requestAnimationFrame(() => {
      if (button.disabled) dialog.current?.focus({ preventScroll: true });
    });
  };
  if (!active) return null;
  return <dialog ref={dialog} tabIndex={-1} className={`${libraryCss.dialog} ${libraryCss.iconDetail} ${css.dialog}`} aria-label={zh ? `${title}下载与代码预览` : `${title} download and code preview`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); }}>
    <button type="button" className={libraryCss.close} onClick={onClose} aria-label={zh ? "关闭下载弹窗" : "Close download dialog"}>×</button>
    <button type="button" className={`${libraryCss.neighbor} ${libraryCss.previous}`} disabled={!previousIcon} aria-label={groupMode ? (zh ? "上一个图组" : "Previous group") : (zh ? "上一个图标" : "Previous icon")} onClick={event => navigate(previousIcon, event.currentTarget)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>{previousIcon ? <img src={svgDataUrl(themeDisplaySvg(previousIcon.svg, theme))} width="40" height="40" alt="" /> : null}</button>
    <button type="button" className={`${libraryCss.neighbor} ${libraryCss.next}`} disabled={!nextIcon} aria-label={groupMode ? (zh ? "下一个图组" : "Next group") : (zh ? "下一个图标" : "Next icon")} onClick={event => navigate(nextIcon, event.currentTarget)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>{nextIcon ? <img src={svgDataUrl(themeDisplaySvg(nextIcon.svg, theme))} width="40" height="40" alt="" /> : null}</button>
    <div className={libraryCss.detailContent}>
      <div className={css.layout} data-six-styles={Boolean(active.hasStyleFamily) || undefined}>
        <div className={`${libraryCss.codeTabs} ${css.tabs}`} aria-label={zh ? "代码格式" : "Code format"}><span aria-hidden="true" className={libraryCss.codeTabIndicator} style={{ left: `calc(${codeTargets.indexOf(codeTarget) * 100 / 6}% + ${6 - codeTargets.indexOf(codeTarget) * 8 / 6}px)` }} />{codeTargets.map(target => <button type="button" key={target} aria-pressed={target === codeTarget} onClick={() => setCodeTarget(target)}>{target}</button>)}</div>
        {groupMode ? <div ref={memberStrip} className={css.memberTabs} aria-label={zh ? "选择图组中的图标" : "Choose an icon from the group"}
          onPointerDown={event => { if (event.pointerType !== "mouse" || event.button !== 0) return; memberDrag.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false }; }}
          onPointerMove={event => { const drag = memberDrag.current; if (!drag || drag.pointerId !== event.pointerId) return; const delta = event.clientX - drag.startX; if (!drag.moved && Math.abs(delta) > 3) { drag.moved = true; event.currentTarget.setPointerCapture(event.pointerId); } if (drag.moved) { event.preventDefault(); event.currentTarget.scrollLeft = drag.scrollLeft - delta; } }}
          onPointerUp={event => { const drag = memberDrag.current; if (!drag || drag.pointerId !== event.pointerId) return; suppressMemberClick.current = drag.moved; memberDrag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (drag.moved) window.setTimeout(() => { suppressMemberClick.current = false; }, 0); }}
          onPointerCancel={() => { memberDrag.current = null; suppressMemberClick.current = false; }}
          onWheel={event => { const strip = event.currentTarget; if (strip.scrollWidth <= strip.clientWidth) return; const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY; if (!delta) return; const next = Math.max(0, Math.min(strip.scrollWidth - strip.clientWidth, strip.scrollLeft + delta)); if (next === strip.scrollLeft) return; event.preventDefault(); strip.scrollLeft = next; }}
          onClickCapture={event => { if (!suppressMemberClick.current) return; suppressMemberClick.current = false; event.preventDefault(); event.stopPropagation(); }}>
          {downloadIcons.map(icon => <button type="button" key={icon.id} aria-label={icon.name} aria-pressed={icon.id === active.id} onClick={() => setActiveId(icon.id)}><img src={svgDataUrl(themeDisplaySvg(icon.svg, theme))} alt="" /></button>)}
        </div> : null}
        {active.hasStyleFamily ? <div className={`${libraryCss.variants} ${css.styleRail}`} aria-label={zh ? "切换风格" : "Change style"}>{LIBRARY_GENERATION_STYLES.map(style => <button type="button" key={style} aria-label={zh ? LIBRARY_GENERATION_LABELS[style].zh : LIBRARY_GENERATION_LABELS[style].en} aria-pressed={activeStyle === style} onClick={() => setActiveStyle(style)}>{activeVariants ? <img src={svgDataUrl(themeDisplaySvg(activeVariants[style], theme))} width="28" height="28" alt="" /> : <i className={css.styleSkeleton} aria-hidden="true" />}<span>{zh ? LIBRARY_GENERATION_LABELS[style].zh : LIBRARY_GENERATION_LABELS[style].en}</span></button>)}</div> : null}
        <div className={`${libraryCss.previewPanel} ${css.preview}`}>
          <div className={libraryCss.metadata}><span>{zh ? "名称" : "Name"}: <strong>{active.name}</strong></span><span>{zh ? "风格" : "Style"}: <strong>{substyle ? (zh ? substyle.zh : substyle.en) : active.styleId || "—"}</strong></span></div>
          <div className={libraryCss.stage}><IconPreviewGrid className={libraryCss.guides}>{activeSvg ? <img className={libraryCss.previewIcon} src={svgDataUrl(themeDisplaySvg(activeSvg, theme))} alt={active.name} /> : <span className={libraryCss.skeleton} aria-label={zh ? "加载风格中" : "Loading style"} />}</IconPreviewGrid></div>
        </div>
        <section className={`${libraryCss.liveCode} ${css.code}`} aria-label={zh ? "代码预览" : "Code preview"}><textarea aria-label={zh ? "代码内容" : "Code content"} readOnly spellCheck={false} wrap="soft" value={code} /><button type="button" onClick={() => void navigator.clipboard.writeText(code).then(() => setMessage(zh ? "代码已复制" : "Code copied")).catch(() => setMessage(zh ? "复制失败，请手动复制" : "Copy failed. Select the code manually."))}>{zh ? "复制代码" : "Copy code"}</button></section>
        <div className={`${libraryCss.controls} ${css.controls}`}>
          <GeneratedSizePicker value={size} onChange={setSize} zh={zh} />
          {baseColor && activeAppearance ? <LibraryColorPicker portal portalAbove portalTargetRef={dialog} zh={zh} value={activeAppearance} onChange={value => setAppearanceOverrides(current => ({ ...current, [active.id]: value }))} /> : null}
          <GeneratedDownloadControl format={format} setFormat={setFormat} busy={busy} zh={zh} groupMode={groupMode} download={() => void download()} />
        </div>
      </div>
    </div>
    {message ? <Toast key={message} message={message} variant={message.includes("失败") || message.includes("failed") ? "error" : "success"} /> : null}
  </dialog>;
}

function GeneratedSizePicker({ value, onChange, zh }: { value: number; onChange: (value: number) => void; zh: boolean }) {
  const { open, setOpen, root, trigger, close, rootProps } = useSelectionPopover();
  const [draft, setDraft] = useState("");
  const choose = (size: number) => { onChange(size); setDraft(""); close(); };
  const valid = /^\d+$/.test(draft) && Number(draft) >= 24 && Number(draft) <= 1024;
  return <div ref={root} className={libraryCss.sizePicker} {...rootProps}>
    <button ref={trigger} type="button" className={libraryCss.sizeTrigger} aria-label={zh ? "输出尺寸" : "Output size"} aria-expanded={open} onClick={() => setOpen(previous => !previous)}><span>{value}px</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }}><path d="m6 9 6 6 6-6" /></svg></button>
    {open ? <SelectionPopover label={zh ? "选择尺寸" : "Choose size"} value={value} options={[24, 32, 48, 64, 128, 256].map(size => ({ value: size, label: size, suffix: "px" }))} onSelect={choose}>
      <div className={libraryCss.sizeDivider} aria-hidden="true"><span /></div>
      <form className={libraryCss.customSize} onSubmit={event => { event.preventDefault(); if (valid) choose(Number(draft)); }}>
        <input aria-label={zh ? "自定义尺寸（24至1024像素）" : "Custom size (24 to 1024 pixels)"} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder={zh ? "尺寸…" : "Size…"} value={draft} onChange={event => setDraft(event.target.value)} title={zh ? "支持24–1024像素" : "24–1024 pixels"} />
        <button type="submit" disabled={!valid} aria-label={zh ? "确认尺寸" : "Apply size"}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></button>
      </form>
    </SelectionPopover> : null}
  </div>;
}

function GeneratedDownloadControl({ format, setFormat, busy, zh, groupMode, download }: { format: FileFormat; setFormat: (value: FileFormat) => void; busy: boolean; zh: boolean; groupMode: boolean; download: () => void }) {
  const { open, setOpen, root, trigger, close, rootProps } = useSelectionPopover();
  const [above, setAbove] = useState(false);
  return <div className={libraryCss.downloadGroup} ref={root} {...rootProps}>
    <button type="button" className={libraryCss.downloadAction} disabled={busy} onClick={download}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" /></svg>{busy ? (zh ? "导出中…" : "Exporting…") : groupMode ? (zh ? "下载图组" : "Download group") : (zh ? "下载" : "Download")}</button>
    <button type="button" ref={trigger} className={libraryCss.formatTrigger} aria-label={zh ? "下载格式" : "Download format"} aria-expanded={open} disabled={busy} onClick={() => { setAbove(window.innerHeight - (root.current?.getBoundingClientRect().bottom ?? 0) < 174); setOpen(previous => !previous); }}><span>.{format}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }}><path d="m6 9 6 6 6-6" /></svg></button>
    {open ? <SelectionPopover label={zh ? "选择下载格式" : "Choose download format"} value={format} options={(["svg", "png", "webp"] as const).map(value => ({ value, label: `.${value}` }))} above={above} align="right" onSelect={value => { setFormat(value); close(); }} /> : null}
  </div>;
}
