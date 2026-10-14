"use client";
import { useEffect, useId, useRef } from "react";
import { generationStyleLabel, type GenerationBrief, type IntentResolution } from "../generation-intent";
import css from "./intent-resolution-dialog.module.css";

export function IntentResolutionDialog({ brief, zh, onChoose, onClose }: { brief: GenerationBrief; zh: boolean; onChoose: (choice: IntentResolution) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const unsupported = brief.styleRequest.kind === "unsupported";
  return <dialog ref={dialog} className={css.dialog} data-canvas-controls aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <h2 id={title}>{zh ? "确认生成要求" : "Confirm design intent"}</h2>
    <p>{brief.styleRequest.message || (zh ? "文字描述与当前所选风格不同，请选择本次使用的风格。" : "Your description differs from the selected style. Choose the style for this request.")}</p>
    {brief.styleRequest.evidence && <blockquote>{brief.styleRequest.evidence}</blockquote>}
    {!unsupported && <div className={css.choices}>
      <button type="button" onClick={() => onChoose("keep")}>{zh ? "保留所选风格" : "Keep selected style"}<strong>{generationStyleLabel(brief.selectedStyleId, zh)}</strong></button>
      <button type="button" onClick={() => onChoose("requested")}>{zh ? "使用描述中的风格" : "Use requested style"}<strong>{generationStyleLabel(brief.styleRequest.styleId!, zh)}</strong></button>
    </div>}
    <button className={css.edit} type="button" onClick={onClose}>{zh ? "返回修改描述" : "Back to edit"}</button>
  </dialog>;
}
