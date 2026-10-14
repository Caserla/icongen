"use client";
import { useEffect, useRef, useState } from "react";
import { StudioInlineColorPicker } from "./studio-color-picker";
import { PROJECT_THEME_PRESETS, projectThemeKeys, type ProjectTheme } from "../project-themes";
import css from "./project-theme-panel.module.css";

export function ThemeMark({ theme }: { theme: ProjectTheme }) {
  return <span className={css.mark} aria-hidden="true">{projectThemeKeys.map(key => <i key={key} style={{ background: theme[key] }} />)}</span>;
}
type ThemeChoice = { source: "ai" | "manual" | "preset"; presetId?: string };
const matchingPreset = (theme: ProjectTheme) => PROJECT_THEME_PRESETS.find(preset => projectThemeKeys.every(key => preset.theme[key].toUpperCase() === theme[key].toUpperCase()));
export function ProjectThemePanel({ open, onClose, theme, aiTheme, customTheme, themeSource = "preset", onSave, zh }: { open: boolean; onClose: () => void; theme: ProjectTheme; aiTheme?: ProjectTheme | null; customTheme?: ProjectTheme | null; themeSource?: string; onSave: (theme: ProjectTheme, choice: ThemeChoice) => void; zh: boolean }) {
  const initialPreset = matchingPreset(theme);
  const sourceChoice = (): ThemeChoice => themeSource === "ai" ? { source: "ai" } : themeSource === "preset" ? { source: "preset", presetId: initialPreset?.id } : { source: "manual" };
  const [draft, setDraft] = useState(theme); const [choice, setChoice] = useState<ThemeChoice>(sourceChoice); const [presets, setPresets] = useState(false); const [expandedColor, setExpandedColor] = useState<keyof ProjectTheme | null>(null); const root = useRef<HTMLDivElement>(null);
  const [previousTheme,setPreviousTheme] = useState({theme,themeSource});
  if (previousTheme.theme !== theme || previousTheme.themeSource !== themeSource) {
    setPreviousTheme({theme,themeSource});
    setDraft(theme);
    setChoice(sourceChoice());
  }
  const presetLabel = choice.source === "ai" ? (zh ? "智能推荐" : "Smart recommendation") : choice.source === "preset" ? (PROJECT_THEME_PRESETS.find(preset => preset.id === choice.presetId)?.name ?? (zh ? "系统预设" : "System preset")) : (zh ? "自定义" : "Custom");
  useEffect(() => { if (!open) return; const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node) && !(e.target as Element).closest('[data-theme-trigger]')) onClose()}; document.addEventListener('pointerdown',close); return()=>document.removeEventListener('pointerdown',close)},[open,onClose]);
  if (!open) return null;
  return <aside ref={root} className={css.panel} data-canvas-controls data-canvas-glass aria-label={zh ? "项目主题色" : "Project theme"}>
    <header><h2>{zh?"项目主题":"Project theme"}</h2></header>
    <div className={css.scrollBody}><section><h3>{zh?"主题预设":"Theme presets"}</h3><button className={css.presetTrigger} type="button" aria-expanded={presets} onClick={()=>setPresets(v=>!v)}><ThemeMark theme={draft}/><span>{presetLabel}</span><i className={css.chevron} aria-hidden="true" /></button>
      {presets ? <div className={css.presets}>
        {aiTheme ? <button type="button" onClick={()=>{setDraft(aiTheme);setChoice({source:"ai"});setPresets(false)}}><ThemeMark theme={aiTheme}/><span>{zh?"智能推荐":"Smart recommendation"}</span></button> : null}
        {customTheme ? <button type="button" onClick={()=>{setDraft(customTheme);setChoice({source:"manual"});setPresets(false)}}><ThemeMark theme={customTheme}/><span>{zh?"自定义":"Custom"}</span></button> : null}
        {PROJECT_THEME_PRESETS.map(p=><button type="button" key={p.id} onClick={()=>{setDraft(p.theme);setChoice({source:"preset",presetId:p.id});setPresets(false)}}><ThemeMark theme={p.theme}/><span>{p.name}</span></button>)}
      </div>:null}
    </section>
    <section><h3>{zh?"四色主题":"Color palette"}</h3><div className={css.colors}>{projectThemeKeys.map(key=><div className={css.colorItem} key={key}><button className={css.colorRow} type="button" aria-expanded={expandedColor===key} onClick={()=>setExpandedColor(current=>current===key?null:key)}><i className={css.colorSwatch} style={{background:draft[key]}}/><span>{key[0].toUpperCase()+key.slice(1)}</span><code>{draft[key]}</code><i className={css.chevron} aria-hidden="true" /></button>{expandedColor===key?<div className={css.inlinePicker}><StudioInlineColorPicker value={draft[key]} onChange={value=>{setDraft(current=>({...current,[key]:value}));setChoice({source:"manual"})}} label={key} locale={zh?"zh":"en"}/></div>:null}</div>)}</div></section>
    </div><footer className={css.footer}><button className={css.save} type="button" onClick={()=>{onSave(draft,choice);onClose()}}>{zh?"保存":"Save"}</button></footer>
  </aside>;
}
