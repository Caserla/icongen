import type { CSSProperties, ReactNode } from "react";
import type { ColorSetting } from "@icongen/shared";

type BackgroundContainer = "rounded-square" | "circle" | "square";

const linearDirections = {
  "top-to-bottom": "to bottom",
  "bottom-to-top": "to top",
  "left-to-right": "to right",
  "right-to-left": "to left",
  "top-left-to-bottom-right": "to bottom right",
  "top-right-to-bottom-left": "to bottom left",
} as const;

function backgroundStyle(color: ColorSetting): CSSProperties {
  if (color.mode === "solid") return { background: color.color };
  if (color.direction === "radial") return { background: `radial-gradient(circle, ${color.colors[0]}, ${color.colors[1]})` };
  return { background: `linear-gradient(${linearDirections[color.direction]}, ${color.colors[0]}, ${color.colors[1]})` };
}

export function BackgroundPreview({ container, color, subjectColor, iconStructure, enabled, cornerRadius, locale, children }: { container: BackgroundContainer; color: ColorSetting; subjectColor: ColorSetting; iconStructure: "linear" | "filled"; enabled: boolean; cornerRadius: number; locale: "en" | "zh"; children?: ReactNode }) {
  const radius = container === "circle" ? "50%" : container === "rounded-square" ? `${cornerRadius}%` : "0";
  const subjectPreviewColor = subjectColor.mode === "solid" ? subjectColor.color : subjectColor.colors[0];
  const transparencyGrid: CSSProperties = {
    backgroundColor: "#fff",
    backgroundImage: "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
    backgroundSize: "16px 16px",
  };

  return <div className="rounded-3xl border border-border bg-background p-4 shadow-sm md:p-5">
    <h3 className="mb-4 text-lg font-black">{locale === "zh" ? "图标批处理规格设置和预览" : "Batch icon specifications and preview"}</h3>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <div className="sticky top-2 z-10 rounded-2xl border border-border bg-surface-muted p-3 lg:top-6">
        <div className="flex min-h-44 items-center justify-center rounded-xl p-3" style={enabled ? undefined : transparencyGrid}>
          <div
            aria-label={locale === "zh" ? "背景实时预览图" : "Live background preview image"}
            className="flex aspect-square w-40 items-center justify-center transition-all duration-200"
            style={enabled ? { ...backgroundStyle(color), borderRadius: radius } : { background: "transparent", borderRadius: 0, boxShadow: "none" }}
          >
            <svg aria-hidden="true" viewBox="0 0 64 64" className="h-28 w-28" fill={iconStructure === "filled" ? subjectPreviewColor : "none"} stroke={subjectPreviewColor} strokeWidth={iconStructure === "linear" ? 3.2 : 0} strokeLinecap="round" strokeLinejoin="round">
              {iconStructure === "linear" ? <>
                <path d="M9 29h11v27H9z" />
                <path d="M20 52c5 3 11 4 17 4h7c4 0 7-3 8-7l4-16c1-4-2-8-6-8H39l2-10c1-4-2-8-6-8l-3 10-12 14v21Z" />
              </> : <>
                <path d="M8 28h12v29H8a3 3 0 0 1-3-3V31a3 3 0 0 1 3-3Z" />
                <path d="M23 29 32 18l3-11c5 0 8 4 7 9l-2 8h10c5 0 8 4 7 9l-4 17c-1 5-5 8-10 8H31c-3 0-6-1-8-3V29Z" />
              </>}
            </svg>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-0">{children}</div>
    </div>
  </div>;
}
