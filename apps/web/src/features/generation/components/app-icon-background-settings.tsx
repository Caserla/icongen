import type { ColorSetting } from "@icongen/shared";
import type {
  BackgroundContainer,
  BackgroundMode,
} from "./interaction-icon-editor";
import { StudioRange } from "./studio-range";
import { StudioColorField } from "./studio-color-field";
import { StudioSegmentedControl } from "./studio-segmented-control";
import { StudioDisclosure } from "./studio-disclosure";

export function AppIconBackgroundSettings({
  mode,
  onModeChange,
  container,
  onContainerChange,
  cornerRadius,
  onCornerRadiusChange,
  locale,
  color,
  onColorChange,
}: {
  mode: BackgroundMode;
  onModeChange: (mode: BackgroundMode) => void;
  container: BackgroundContainer;
  onContainerChange: (container: BackgroundContainer) => void;
  cornerRadius: number;
  onCornerRadiusChange: (cornerRadius: number) => void;
  locale: "en" | "zh";
  color?: ColorSetting;
  onColorChange?: (color: ColorSetting) => void;
}) {
  return (
    <section>
      <StudioSegmentedControl value={mode} onChange={onModeChange} options={locale === "zh" ? [{ value: "transparent", label: "透明背景" }, { value: "solid", label: "单色背景" }, { value: "gradient", label: "渐变背景" }] : [{ value: "transparent", label: "None" }, { value: "solid", label: "Solid" }, { value: "gradient", label: "Gradient" }]} />
      {mode !== "transparent" ? (
        <div className="mt-1 space-y-2">
          <StudioSegmentedControl value={container} onChange={onContainerChange} ariaLabel={locale === "zh" ? "背景形状" : "Background shape"} size="small" options={locale === "zh" ? [{ value: "rounded-square", label: "圆角" }, { value: "circle", label: "圆形" }, { value: "square", label: "方块" }] : [{ value: "rounded-square", label: "Rounded" }, { value: "circle", label: "Circle" }, { value: "square", label: "Square" }]} />
          {container === "rounded-square" ? (
            <StudioRange label={locale === "zh" ? "圆角角度" : "Round corners"} min={4} max={40} suffix="%" value={cornerRadius} onChange={onCornerRadiusChange} />
          ) : null}
          {color && onColorChange ? (
            <BackgroundColorSettings
              mode={mode}
              value={color}
              onChange={onColorChange}
              locale={locale}
            />
          ) : null}
        </div>
      ) : null}
      {!color ? (
        <p className="mt-2 text-xs text-muted">
          {locale === "zh"
            ? "背景配色将根据图标内容与所选风格自动生成。"
            : "Background colors are generated automatically from the icon content and selected style."}
        </p>
      ) : null}
    </section>
  );
}

const hexPattern = /^#[0-9A-Fa-f]{6}$/;
const gradientDirections = [
  "top-to-bottom",
  "bottom-to-top",
  "left-to-right",
  "right-to-left",
  "top-left-to-bottom-right",
  "top-right-to-bottom-left",
  "radial",
] as const;
const gradientDirectionLabels = {
  "top-to-bottom": { zh: "从上到下", en: "Top to bottom" },
  "bottom-to-top": { zh: "从下到上", en: "Bottom to top" },
  "left-to-right": { zh: "从左到右", en: "Left to right" },
  "right-to-left": { zh: "从右到左", en: "Right to left" },
  "top-left-to-bottom-right": { zh: "左上到右下", en: "Top left to bottom right" },
  "top-right-to-bottom-left": { zh: "右上到左下", en: "Top right to bottom left" },
  radial: { zh: "径向", en: "Radial" },
} as const;

function BackgroundColorSettings({ mode, value, onChange, locale }: {
  mode: BackgroundMode;
  value: ColorSetting;
  onChange: (color: ColorSetting) => void;
  locale: "en" | "zh";
}) {
  if (mode === "solid") {
    const color = value.mode === "solid" ? value.color : value.colors[0];
    const update = (next: string) => {
      if (hexPattern.test(next)) onChange({ mode: "solid", color: next.toUpperCase() });
    };
    return (
      <StudioColorField label={locale === "zh" ? "背景颜色" : "Background color"} value={color} onChange={update} locale={locale} />
    );
  }
  if (mode !== "gradient") return null;
  const gradient = value.mode === "gradient" ? value : {
    mode: "gradient" as const,
    colors: [value.color, "#A78BFA"] as [string, string],
    direction: "top-left-to-bottom-right" as const,
  };
  const updateColor = (index: number, next: string) => {
    if (!hexPattern.test(next)) return;
    onChange({ ...gradient, colors: index === 0 ? [next.toUpperCase(), gradient.colors[1]] : [gradient.colors[0], next.toUpperCase()] });
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {gradient.colors.map((color, index) => {
        const label = locale === "zh" ? (index === 0 ? "起始颜色" : "终点颜色") : (index === 0 ? "Start color" : "End color");
        return (
          <StudioColorField key={index} label={label} value={color} onChange={(next) => updateColor(index, next)} locale={locale} variant="gradient" />
        );
      })}
      <StudioDisclosure className="studio-gradient-direction col-span-2" label={locale === "zh" ? "渐变方向" : "Gradient direction"} value={gradientDirectionLabels[gradient.direction][locale]}>
        <div className="studio-gradient-direction__items">
          {gradientDirections.map((direction) => (
            <button
              key={direction}
              type="button"
              aria-pressed={gradient.direction === direction}
              onClick={(event) => {
                onChange({ ...gradient, direction });
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              {gradientDirectionLabels[direction][locale]}
            </button>
          ))}
        </div>
      </StudioDisclosure>
    </div>
  );
}
