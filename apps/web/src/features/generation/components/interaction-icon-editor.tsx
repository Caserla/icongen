import { BACKGROUND_TYPE_OPTION_IDS, type ColorSetting } from "@icongen/shared";
import { BackgroundPreview } from "./background-preview";
import { StudioRange } from "./studio-range";
import { StudioColorField } from "./studio-color-field";
import { StudioSegmentedControl } from "./studio-segmented-control";
import { StudioSettingsPanel } from "./studio-settings-panel";

export type IconStructure = "linear" | "filled";
export type BackgroundMode = "transparent" | "solid" | "gradient";
export type BackgroundContainer = (typeof BACKGROUND_TYPE_OPTION_IDS)[number];
const hexPattern = /^#[0-9A-Fa-f]{6}$/;

function SubjectColorEditor({
  value,
  onChange,
  locale,
  opacity,
  onOpacityChange,
}: {
  value: ColorSetting;
  onChange: (value: ColorSetting) => void;
  locale: "en" | "zh";
  opacity: number;
  onOpacityChange: (value: number) => void;
}) {
  const gradient =
    value.mode === "gradient"
      ? value
      : {
          mode: "gradient" as const,
          colors: [value.color, "#A78BFA"] as [string, string],
          direction: "top-left-to-bottom-right" as const,
        };
  function updateColor(color: string) {
    if (hexPattern.test(color))
      onChange({ mode: "solid", color: color.toUpperCase() });
  }
  return (
    <div className="mt-3 space-y-3">
      <StudioSegmentedControl value={value.mode} onChange={mode => onChange(mode === "solid" ? { mode, color: value.mode === "solid" ? value.color : value.colors[0] } : gradient)} options={locale === "zh" ? [{ value: "solid", label: "纯色" }, { value: "gradient", label: "多色" }] : [{ value: "solid", label: "Solid" }, { value: "gradient", label: "Multicolor" }]} />
      {value.mode === "solid" ? (
        <StudioColorField label={locale === "zh" ? "颜色值" : "Color value"} value={value.color} onChange={updateColor} locale={locale} alpha={opacity} onAlphaChange={onOpacityChange} />
      ) : (
        <p className="rounded-[4px] border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          {locale === "zh"
            ? "颜色将根据图标内容与所选风格自动生成。"
            : "Colors are generated automatically from the icon content and selected style."}
        </p>
      )}
    </div>
  );
}

export function InteractionIconEditor(props: {
  locale: "en" | "zh";
  iconStructure: IconStructure;
  onIconStructureChange: (value: IconStructure) => void;
  subjectSizePercent: number;
  onSubjectSizePercentChange: (value: number) => void;
  linearStrokeWidthPercent: number;
  onLinearStrokeWidthPercentChange: (value: number) => void;
  subjectOpacityPercent: number;
  onSubjectOpacityPercentChange: (value: number) => void;
  subjectColor: ColorSetting;
  onSubjectColorChange: (value: ColorSetting) => void;
  backgroundMode: BackgroundMode;
  backgroundContainer: BackgroundContainer;
  cornerRadius: number;
  backgroundColor: ColorSetting;
}) {
  const {
    locale,
    iconStructure,
    onIconStructureChange,
    subjectSizePercent,
    onSubjectSizePercentChange,
    linearStrokeWidthPercent,
    onLinearStrokeWidthPercentChange,
    subjectOpacityPercent,
    onSubjectOpacityPercentChange,
    subjectColor,
    onSubjectColorChange,
    backgroundMode,
    backgroundContainer,
    cornerRadius,
    backgroundColor,
  } = props;
  const backgroundEnabled = backgroundMode !== "transparent";
  return (
    <div className="mt-6">
      <BackgroundPreview
        container={backgroundContainer}
        color={backgroundColor}
        subjectColor={subjectColor}
        iconStructure={iconStructure}
        subjectSizePercent={subjectSizePercent}
        linearStrokeWidthPercent={linearStrokeWidthPercent}
        subjectOpacityPercent={subjectOpacityPercent}
        enabled={backgroundEnabled}
        cornerRadius={cornerRadius}
        locale={locale}
      >
        <StudioSettingsPanel title={locale === "zh" ? "图形结构" : "Icon structure"}>
          <fieldset>
            <legend className="sr-only">{locale === "zh" ? "图形结构" : "Icon structure"}</legend>
            <StudioSegmentedControl value={iconStructure} onChange={onIconStructureChange} className="mt-2" options={locale === "zh" ? [{ value: "linear", label: "线性" }, { value: "filled", label: "面性" }] : [{ value: "linear", label: "Linear" }, { value: "filled", label: "Filled" }]} />
          </fieldset>
          <div className="mt-3 grid max-w-md gap-3">
            {iconStructure === "linear" ? (
              <StudioRange label={locale === "zh" ? "线条粗细" : "Stroke width"} min={2} max={6} step={0.5} decimals={1} suffix="%" value={linearStrokeWidthPercent} onChange={onLinearStrokeWidthPercentChange} />
            ) : null}
            <StudioRange label={locale === "zh" ? "主体大小" : "Subject size"} min={50} max={85} suffix="%" value={subjectSizePercent} onChange={onSubjectSizePercentChange} />
          </div>
        </StudioSettingsPanel>
        <StudioSettingsPanel title={locale === "zh" ? "主体颜色" : "Icon color"}>
          <SubjectColorEditor
            value={subjectColor}
            onChange={onSubjectColorChange}
            locale={locale}
            opacity={subjectOpacityPercent}
            onOpacityChange={onSubjectOpacityPercentChange}
          />
        </StudioSettingsPanel>
      </BackgroundPreview>
    </div>
  );
}
