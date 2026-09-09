import type { CSSProperties, ReactNode } from "react";
import type { ColorSetting } from "@icongen/shared";
import { IconPreviewGrid } from "./icon-preview-grid";

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
  const rgba = (hex: string, alpha = 1) => `rgb(${[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(" ")} / ${alpha})`;
  const stops = `${rgba(color.colors[0], color.alpha)} ${color.startOffset ?? 0}%, ${rgba(color.colors[1], color.endAlpha)} ${color.endOffset ?? 100}%`;
  if (color.direction === "radial")
    return {
      background: `radial-gradient(circle, ${stops})`,
    };
  return {
    background: `linear-gradient(${color.angle === undefined ? linearDirections[color.direction] : `${color.angle}deg`}, ${stops})`,
  };
}

export function BackgroundPreview({
  container,
  color,
  subjectColor,
  iconStructure,
  subjectSizePercent,
  linearStrokeWidthPercent,
  subjectOpacityPercent = 100,
  enabled,
  cornerRadius,
  locale,
  children,
}: {
  container: BackgroundContainer;
  color: ColorSetting;
  subjectColor: ColorSetting;
  iconStructure: "linear" | "filled";
  subjectSizePercent: number;
  linearStrokeWidthPercent: number;
  subjectOpacityPercent?: number;
  enabled: boolean;
  cornerRadius: number;
  locale: "en" | "zh";
  children?: ReactNode;
}) {
  const radius =
    container === "circle"
      ? "50%"
      : container === "rounded-square"
        ? `${cornerRadius}%`
        : "0";
  const subjectPreviewColor =
    subjectColor.mode === "solid" ? subjectColor.color : subjectColor.colors[0];
  return (
    <div className="creation-editor">
      <div className="creation-editor__canvas">
        <div className="creation-editor__toolbar">
          <span>ICON PREVIEW</span>
          <span>1024 × 1024</span>
        </div>
        <div className="creation-editor__stage">
          <IconPreviewGrid className="creation-editor__preview">
          <div
            aria-label={
              locale === "zh"
                ? "背景实时预览图"
                : "Live background preview image"
            }
            className="flex h-full w-full aspect-square items-center justify-center transition-all duration-200"
            style={
              enabled
                ? { ...backgroundStyle(color), borderRadius: radius }
                : {
                    background: "transparent",
                    borderRadius: 0,
                    boxShadow: "none",
                  }
            }
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 64 64"
              className="transition-all duration-200"
              style={{
                width: `${subjectSizePercent}%`,
                height: `${subjectSizePercent}%`,
                opacity: subjectOpacityPercent / 100,
              }}
              fill={iconStructure === "filled" ? subjectPreviewColor : "none"}
              stroke={subjectPreviewColor}
              strokeWidth={
                iconStructure === "linear"
                  ? (64 * linearStrokeWidthPercent) / 100
                  : 0
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {iconStructure === "linear" ? (
                <>
                  <path d="M9 29h11v27H9z" />
                  <path d="M20 52c5 3 11 4 17 4h7c4 0 7-3 8-7l4-16c1-4-2-8-6-8H39l2-10c1-4-2-8-6-8l-3 10-12 14v21Z" />
                </>
              ) : (
                <>
                  <path d="M8 28h12v29H8a3 3 0 0 1-3-3V31a3 3 0 0 1 3-3Z" />
                  <path d="M23 29 32 18l3-11c5 0 8 4 7 9l-2 8h10c5 0 8 4 7 9l-4 17c-1 5-5 8-10 8H31c-3 0-6-1-8-3V29Z" />
                </>
              )}
            </svg>
          </div>
          </IconPreviewGrid>
          <p className="creation-editor__caption">
            {locale === "zh"
              ? "预览图，非最终生成效果"
              : "Preview only. Final results may vary."}
          </p>
        </div>
      </div>
      <aside className="creation-editor__controls">
        <div className="creation-editor__control-stack">{children}</div>
      </aside>
    </div>
  );
}
