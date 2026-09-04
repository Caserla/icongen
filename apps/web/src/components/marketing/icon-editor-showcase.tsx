"use client";

import Image from "next/image";
import { useState } from "react";

export function IconEditorShowcase({ locale }: { locale: "en" | "zh" }) {
  const [scale, setScale] = useState(72);
  const [radius, setRadius] = useState(24);
  const [background, setBackground] = useState<"mint" | "peach" | "iris">("mint");
  const colors = { mint: "#91e2c0", peach: "#ffb28d", iris: "#7357ff" };

  return (
    <section className="icon-editor-story">
      <div className="icon-editor-shell">
        <div className="icon-editor-canvas">
          <div
            className="icon-editor-preview"
            style={{ borderRadius: `${radius}%`, background: colors[background] }}
          >
            <Image
              src="/images/icon-style-previews/hd-native/flat-playful-v13.png"
              alt={locale === "zh" ? "图标编辑器实时预览" : "Live icon editor preview"}
              width={512}
              height={512}
              style={{ width: `${scale}%`, height: `${scale}%` }}
            />
          </div>
          <span className="icon-editor-canvas__size">1024 × 1024</span>
        </div>
        <aside className="icon-editor-controls" aria-label={locale === "zh" ? "图标编辑器控件" : "Icon editor controls"}>
          <div className="icon-editor-controls__head"><span>ICON / 01</span><i>●</i></div>
          <Control label={locale === "zh" ? "主体大小" : "Icon size"} value={scale} onChange={setScale} />
          <Control label={locale === "zh" ? "圆角" : "Corner radius"} value={radius} onChange={setRadius} />
          <div className="icon-editor-control">
            <div><span>{locale === "zh" ? "背景" : "Background"}</span><strong>{background.toUpperCase()}</strong></div>
            <div className="icon-editor-swatches">
              {(Object.keys(colors) as Array<keyof typeof colors>).map((color) => (
                <button key={color} type="button" onClick={() => setBackground(color)} aria-label={`${locale === "zh" ? "选择" : "Select"} ${color}`} aria-pressed={background === color} style={{ background: colors[color] }} />
              ))}
            </div>
          </div>
          <div className="icon-editor-control icon-editor-format">
            <div><span>{locale === "zh" ? "导出格式" : "Export"}</span><strong>PNG + SVG</strong></div>
          </div>
          <button type="button" className="icon-editor-done">{locale === "zh" ? "应用调整" : "Apply changes"}<span>↗</span></button>
        </aside>
      </div>
      <div className="icon-editor-story__copy">
        <p className="butter-kicker">{locale === "zh" ? "细节，完全由你掌控。" : "Fine-tune every detail."}</p>
        <h2>{locale === "zh" ? "生成之后，继续把图标调到刚刚好。" : "Generate first. Then make every icon feel exactly right."}</h2>
        <p>{locale === "zh" ? "调整主体大小、圆角与背景，在导出之前实时看到结果。" : "Tune scale, corners, and background with a live preview before you export."}</p>
      </div>
    </section>
  );
}

function Control({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="icon-editor-control">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <input type="range" min="10" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
