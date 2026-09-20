"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SWATCHES = [
  "#FFFFFF",
  "#D4D4D8",
  "#787878",
  "#252525",
  "#0A0909",
  "#FF1717",
  "#FF7A1A",
  "#FFD600",
  "#7AE582",
  "#00C2A8",
  "#38BDF8",
  "#2563EB",
  "#7C3AED",
  "#A78BFA",
  "#EC4899",
];

function hexToHsv(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d)
    h =
      max === r
        ? ((g - b) / d) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return `#${[r, g, b]
    .map((n) =>
      Math.round((n + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

export function StudioColorPicker({
  value,
  onChange,
  label,
  locale,
  alpha: controlledAlpha,
  onAlphaChange,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  locale: "en" | "zh";
  alpha?: number;
  onAlphaChange?: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value.toUpperCase());
  const [editingHex, setEditingHex] = useState(false);
  const [tab, setTab] = useState<"swatches" | "custom">("custom");
  const [localAlpha, setLocalAlpha] = useState(100);
  const alpha = controlledAlpha ?? localAlpha;
  const setAlpha = onAlphaChange ?? setLocalAlpha;
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const hsv = hexToHsv(value);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !popover.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [open]);
  const setSV = (event: React.PointerEvent<HTMLDivElement>) => {
    const r = event.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (event.clientX - r.left) / r.width));
    const v = 1 - Math.max(0, Math.min(1, (event.clientY - r.top) / r.height));
    onChange(hsvToHex(hsv.h, s, v));
  };
  return (
    <div ref={root} className="studio-picker-anchor">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        className="studio-color-swatch"
        style={{
          background: `linear-gradient(rgb(255 255 255 / ${1 - alpha / 100}), rgb(255 255 255 / ${1 - alpha / 100})), ${value}`,
        }}
        onClick={() => {
          const rect = root.current?.getBoundingClientRect();
          if (rect) {
            const rightSide = rect.right + 10;
            const leftSide = rect.left - 276;
            const left =
              rightSide + 266 <= window.innerWidth - 12
                ? rightSide
                : Math.max(
                    window.innerWidth * 0.5,
                    Math.min(window.innerWidth - 278, leftSide),
                  );
            const top =
              rect.top >= 326
                ? rect.top - 316
                : Math.min(window.innerHeight - 318, rect.bottom + 10);
            setPosition({ left, top: Math.max(12, top) });
          }
          setDraft(value.toUpperCase());
          setEditingHex(false);
          setOpen((v) => !v);
        }}
      />
      {open
        ? createPortal(
            <div
              ref={popover}
              className="studio-color-popover"
              style={position}
              role="dialog"
              aria-label={label}
            >
              <div className="studio-picker-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "swatches"}
                  onClick={() => setTab("swatches")}
                >
                  {locale === "zh" ? "色板" : "Swatches"}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "custom"}
                  onClick={() => setTab("custom")}
                >
                  {locale === "zh" ? "自定义" : "Custom"}
                </button>
              </div>
              {tab === "swatches" ? (
                <div className="studio-picker-swatches" role="tabpanel">
                  {SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      aria-pressed={value.toUpperCase() === color}
                      style={{ backgroundColor: color }}
                      onClick={() => onChange(color)}
                    />
                  ))}
                </div>
              ) : (
                <div role="tabpanel">
                  <input
                    value={editingHex ? draft : value.toUpperCase()}
                    onChange={(e) => setDraft(e.target.value.toUpperCase())}
                    onFocus={(e) => {
                      setDraft(value.toUpperCase());
                      setEditingHex(true);
                      e.currentTarget.select();
                    }}
                    onBlur={() => {
                      if (HEX.test(draft)) onChange(draft);
                      else setDraft(value.toUpperCase());
                      setEditingHex(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="studio-picker-hex"
                  />
                  <div
                    className="studio-picker-saturation"
                    style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setSV(e);
                    }}
                    onPointerMove={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId))
                        setSV(e);
                    }}
                  >
                    <span
                      className="studio-picker-cursor"
                      style={{
                        left: `${hsv.s * 100}%`,
                        top: `${(1 - hsv.v) * 100}%`,
                      }}
                    />
                  </div>
                  <input
                    aria-label={`${label} hue`}
                    type="range"
                    min="0"
                    max="360"
                    value={Math.round(hsv.h)}
                    onChange={(e) =>
                      onChange(hsvToHex(Number(e.target.value), hsv.s, hsv.v))
                    }
                    className="studio-picker-hue"
                  />
                  <input
                    aria-label={`${label} opacity`}
                    type="range"
                    min="0"
                    max="100"
                    value={alpha}
                    onInput={(event) =>
                      setAlpha(Number(event.currentTarget.value))
                    }
                    onChange={(event) => setAlpha(Number(event.target.value))}
                    className="studio-picker-alpha"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${value}), repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 / 8px 8px`,
                    }}
                  />
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function StudioInlineColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  locale: "en" | "zh";
}) {
  const [draft, setDraft] = useState(value.toUpperCase());
  const [editingHex, setEditingHex] = useState(false);
  const hsv = hexToHsv(value);
  const setSV = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const brightness = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    onChange(hsvToHex(hsv.h, saturation, brightness));
  };

  return (
    <div className="studio-inline-color-picker" aria-label={label}>
      <div className="studio-inline-color-area">
        <div className="studio-picker-saturation" style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setSV(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setSV(event); }}>
          <span className="studio-picker-cursor" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
        </div>
        <div className="studio-picker-hue-track">
          <input aria-label={`${label} hue`} type="range" min="0" max="360" value={Math.round(hsv.h)} onChange={event => onChange(hsvToHex(Number(event.target.value), hsv.s, hsv.v))} className="studio-picker-hue" />
          <span className="studio-picker-hue-cursor" style={{ left: `${hsv.h / 360 * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }} aria-hidden="true" />
        </div>
      </div>
      <label className="studio-inline-hex-row">
        <input aria-label={`${label} hex`} value={editingHex ? draft : value.toUpperCase()} onChange={event => setDraft(event.target.value.toUpperCase())} onFocus={event => { setDraft(value.toUpperCase()); setEditingHex(true); event.currentTarget.select(); }} onBlur={() => { if (HEX.test(draft)) onChange(draft); else setDraft(value.toUpperCase()); setEditingHex(false); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
        <span style={{ background: value }} aria-hidden="true" />
      </label>
    </div>
  );
}
