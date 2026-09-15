import type {
  ColorSetting,
  IllustrationComposition,
} from "@icongen/shared";
import type {
  BackgroundContainer,
  BackgroundMode,
} from "./interaction-icon-editor";
import { StudioRange } from "./studio-range";
import { StudioColorField } from "./studio-color-field";
import { StudioSegmentedControl } from "./studio-segmented-control";
import { LibraryColorPicker } from "@/features/library/library-color-picker";

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
  subjectSizePercent,
  onSubjectSizePercentChange,
  autoColor = false,
  onAutoColorChange,
  illustrationComposition,
  onIllustrationCompositionChange,
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
  subjectSizePercent?: number;
  onSubjectSizePercentChange?: (value: number) => void;
  autoColor?: boolean;
  onAutoColorChange?: (value: boolean) => void;
  illustrationComposition?: IllustrationComposition;
  onIllustrationCompositionChange?: (value: IllustrationComposition) => void;
}) {
  return (
    <section>
      {subjectSizePercent !== undefined && onSubjectSizePercentChange ? (
        <div className="mb-2">
          <StudioRange
            label={locale === "zh" ? "主体大小" : "Subject size"}
            min={50}
            max={85}
            suffix="%"
            value={subjectSizePercent}
            onChange={onSubjectSizePercentChange}
          />
        </div>
      ) : null}
      {illustrationComposition && onIllustrationCompositionChange ? (
        <div className="mb-2">
          <span className="mb-2 block text-xs font-semibold text-muted">
            {locale === "zh" ? "构图方式" : "Composition"}
          </span>
          <StudioSegmentedControl
            className="studio-structure-tabs studio-structure-tabs--three"
            value={illustrationComposition}
            onChange={onIllustrationCompositionChange}
            ariaLabel={locale === "zh" ? "构图方式" : "Composition"}
            options={
              locale === "zh"
                ? [
                    { value: "centered", label: "标准居中" },
                    { value: "edge-anchored", label: "贴边构图" },
                    { value: "full-bleed-scene", label: "场景满版" },
                  ]
                : [
                    { value: "centered", label: "Centered" },
                    { value: "edge-anchored", label: "Edge anchored" },
                    { value: "full-bleed-scene", label: "Full scene" },
                  ]
            }
          />
        </div>
      ) : null}
      <StudioSegmentedControl
        className="studio-structure-tabs studio-structure-tabs--three"
        ariaLabel={locale === "zh" ? "背景类型" : "Background type"}
        value={mode}
        onChange={onModeChange}
        options={
          locale === "zh"
            ? [
                { value: "transparent", label: "透明背景" },
                { value: "solid", label: "单色背景" },
                { value: "gradient", label: "渐变背景" },
              ]
            : [
                { value: "transparent", label: "None" },
                { value: "solid", label: "Solid" },
                { value: "gradient", label: "Gradient" },
              ]
        }
      />
      {mode !== "transparent" ? (
        <div className="mt-1 space-y-2">
          <StudioSegmentedControl
            className="studio-structure-tabs studio-structure-tabs--three"
            value={container}
            onChange={onContainerChange}
            ariaLabel={locale === "zh" ? "背景形状" : "Background shape"}
            options={
              locale === "zh"
                ? [
                    { value: "rounded-square", label: "圆角" },
                    { value: "circle", label: "圆形" },
                    { value: "square", label: "方块" },
                  ]
                : [
                    { value: "rounded-square", label: "Rounded" },
                    { value: "circle", label: "Circle" },
                    { value: "square", label: "Square" },
                  ]
            }
          />
          {container === "rounded-square" ? (
            <StudioRange
              label={locale === "zh" ? "圆角角度" : "Round corners"}
              min={4}
              max={40}
              suffix="%"
              value={cornerRadius}
              onChange={onCornerRadiusChange}
            />
          ) : null}
          {onAutoColorChange ? (
            <div>
              <span className="mb-2 block text-xs font-semibold text-muted">
                {locale === "zh" ? "颜色生成方式" : "Color generation"}
              </span>
              <StudioSegmentedControl
                className="studio-structure-tabs"
                size="small"
                value={autoColor ? "automatic" : "manual"}
                onChange={(value) => onAutoColorChange(value === "automatic")}
                ariaLabel={locale === "zh" ? "颜色生成方式" : "Color generation"}
                options={
                  locale === "zh"
                    ? [
                        { value: "automatic", label: "自动生成" },
                        { value: "manual", label: "手动设置" },
                      ]
                    : [
                        { value: "automatic", label: "Automatic" },
                        { value: "manual", label: "Manual" },
                      ]
                }
              />
            </div>
          ) : null}
          {!autoColor && color && onColorChange ? (
            <BackgroundColorSettings
              mode={mode}
              value={color}
              onChange={(next) => {
                onColorChange(next);
                if (next.mode !== mode) onModeChange(next.mode);
              }}
              locale={locale}
            />
          ) : null}
          {autoColor ? (
            <p className="text-xs text-muted">
              {locale === "zh"
                ? "将根据图标内容与所选风格自动生成协调的背景配色。"
                : "A coordinated background palette will be generated from the icon content and selected style."}
            </p>
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
const gradientAngles = {
  "top-to-bottom": 180, "bottom-to-top": 0,
  "left-to-right": 90, "right-to-left": 270,
  "top-left-to-bottom-right": 135, "top-right-to-bottom-left": 225,
  radial: 135,
} as const;

function BackgroundColorSettings({
  mode,
  value,
  onChange,
  locale,
}: {
  mode: BackgroundMode;
  value: ColorSetting;
  onChange: (color: ColorSetting) => void;
  locale: "en" | "zh";
}) {
  if (mode === "solid") {
    const color = value.mode === "solid" ? value.color : value.colors[0];
    const update = (next: string) => {
      if (hexPattern.test(next))
        onChange({ mode: "solid", color: next.toUpperCase() });
    };
    return (
      <StudioColorField
        label={locale === "zh" ? "背景颜色" : "Background color"}
        value={color}
        onChange={update}
        locale={locale}
      />
    );
  }
  if (mode !== "gradient") return null;
  const gradient: Extract<ColorSetting, { mode: "gradient" }> =
    value.mode === "gradient"
      ? value
      : {
          mode: "gradient" as const,
          colors: [value.color, "#A78BFA"] as [string, string],
          direction: "top-left-to-bottom-right" as const,
        };
  return (
    <LibraryColorPicker
      gradientOnly
      portal
      zh={locale === "zh"}
      value={{
        size: 24,
        mode: gradient.direction === "radial" ? "radial" : "linear",
        color: gradient.colors[0],
        endColor: gradient.colors[1],
        angle: gradient.angle ?? gradientAngles[gradient.direction],
        startOffset: gradient.startOffset,
        endOffset: gradient.endOffset,
        alpha: gradient.alpha,
        endAlpha: gradient.endAlpha,
      }}
      onChange={(next) => onChange(next.mode === "solid"
        ? { mode: "solid", color: next.color }
        : {
            mode: "gradient",
            colors: [next.color, next.endColor],
            direction: next.mode === "radial" ? "radial" : "top-left-to-bottom-right",
            angle: next.angle,
            startOffset: next.startOffset,
            endOffset: next.endOffset,
            alpha: next.alpha,
            endAlpha: next.endAlpha,
          })}
    />
  );
}
