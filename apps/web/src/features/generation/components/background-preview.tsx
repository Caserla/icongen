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

export function BackgroundPreview({ container, color, subjectColor, enabled, cornerRadius, locale, children }: { container: BackgroundContainer; color: ColorSetting; subjectColor: ColorSetting; enabled: boolean; cornerRadius: number; locale: "en" | "zh"; children?: ReactNode }) {
  const radius = container === "circle" ? "50%" : container === "rounded-square" ? `${cornerRadius}%` : "0";
  const transparencyGrid: CSSProperties = {
    backgroundColor: "#fff",
    backgroundImage: "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
    backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
    backgroundSize: "16px 16px",
  };

  return <div className="rounded-3xl border border-border bg-background p-4 shadow-sm md:p-5">
    <h2 className="mb-4 text-xl font-black">2–3. {locale === "zh" ? "图标预览与设置" : "Icon preview and settings"}</h2>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
      <div className="sticky top-2 z-10 rounded-2xl border border-border bg-surface-muted p-3 lg:top-6">
        <div className="flex min-h-44 items-center justify-center rounded-xl p-3" style={enabled ? undefined : transparencyGrid}>
          <div
            aria-label={locale === "zh" ? "背景实时预览图" : "Live background preview image"}
            className="flex aspect-square w-40 items-center justify-center shadow-lg transition-all duration-200"
            style={enabled ? { ...backgroundStyle(color), borderRadius: radius } : { background: "transparent", borderRadius: 0, boxShadow: "none" }}
          >
            <svg aria-hidden="true" viewBox="0 0 1024 1024" className="h-32 w-32 drop-shadow-sm">
          <defs>
            <filter id="line-icon-color" colorInterpolationFilters="sRGB">
              <feColorMatrix values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0" result="inverted" />
              <feColorMatrix in="inverted" type="luminanceToAlpha" result="icon-mask" />
              <feFlood floodColor={subjectColor.mode === "solid" ? subjectColor.color : subjectColor.colors[0]} result="icon-color" />
              <feComposite in="icon-color" in2="icon-mask" operator="in" />
            </filter>
          </defs>
          <image href="/images/icon-style-previews/hd-native/line-icon-home-v2.png" width="1024" height="1024" filter="url(#line-icon-color)" />
            </svg>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:gap-0">{children}</div>
    </div>
  </div>;
}
