"use client";

import { useState } from "react";
import { StudioColorPicker } from "./studio-color-picker";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function StudioColorField({ label, value, onChange, locale, variant = "standard", alpha, onAlphaChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  locale: "en" | "zh";
  variant?: "standard" | "gradient";
  alpha?: number;
  onAlphaChange?: (value: number) => void;
}) {
  const normalized = value.toUpperCase();
  const [draft, setDraft] = useState(normalized);
  const [editing, setEditing] = useState(false);
  const commit = () => {
    if (HEX.test(draft)) onChange(draft.toUpperCase());
    else setDraft(normalized);
    setEditing(false);
  };
  const gradient = variant === "gradient";
  return <label className={gradient ? "studio-gradient-color-card min-w-0 p-3" : "studio-color-value block p-3 text-sm font-semibold"}>
    <span className={gradient ? "studio-gradient-color-card__label mb-2 block text-sm font-semibold" : "mb-2 block"}>{label}</span>
    <span className={gradient ? "studio-gradient-color flex min-w-0 items-center gap-2" : "flex items-center gap-2"}>
      <StudioColorPicker value={value} onChange={onChange} label={label} locale={locale} alpha={alpha} onAlphaChange={onAlphaChange} />
      <input aria-label={`${label} HEX`} value={editing ? draft : normalized} onChange={event => setDraft(event.target.value.toUpperCase())} onFocus={event => { setDraft(normalized); setEditing(true); event.currentTarget.select(); }} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} placeholder="#RRGGBB" className={gradient ? "studio-gradient-color__input min-w-0 w-full px-3 font-mono text-xs uppercase outline-none" : "draft-control studio-color-value__input min-w-0 flex-1 px-4 font-mono font-normal uppercase"} />
    </span>
  </label>;
}
