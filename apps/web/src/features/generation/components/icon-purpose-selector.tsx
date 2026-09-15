import { StudioSegmentedControl } from "./studio-segmented-control";
import type { IllustrationSubset } from "@icongen/shared";

export type IconPurpose = "interaction" | "app-icon";

export function IconPurposeSelector({
  value,
  onChange,
  locale,
  illustrationSubset,
  onIllustrationSubsetChange,
}: {
  value: IconPurpose;
  onChange: (value: IconPurpose) => void;
  locale: "en" | "zh";
  illustrationSubset: IllustrationSubset;
  onIllustrationSubsetChange: (value: IllustrationSubset) => void;
}) {
  const options = (["interaction", "app-icon"] as const).map((purpose) => ({
    value: purpose,
    label:
      locale === "zh"
        ? purpose === "interaction"
          ? "交互设计"
          : "插画设计"
        : purpose === "interaction"
          ? "Interaction design"
          : "Illustration icons",
  }));

  return (
    <div
      className="purpose-switch"
      role="group"
      aria-label={locale === "zh" ? "图标用途" : "Icon purpose"}
    >
      <span className="purpose-switch__label">
        {locale === "zh" ? "图标类型" : "Icon type"}
      </span>
      <StudioSegmentedControl
        className="studio-structure-tabs studio-structure-tabs--vertical"
        value={value}
        onChange={onChange}
        options={options}
      />
      {value === "app-icon" ? (
        <div className="mt-3 w-full">
          <span className="mb-2 block text-xs font-semibold text-zinc-500">
            {locale === "zh" ? "用途分类" : "Use category"}
          </span>
          <StudioSegmentedControl
            className="studio-structure-tabs studio-structure-tabs--vertical"
            size="small"
            value={illustrationSubset}
            onChange={onIllustrationSubsetChange}
            ariaLabel={locale === "zh" ? "用途分类" : "Use category"}
            options={[
              { value: "general", label: locale === "zh" ? "通用插画" : "General" },
              { value: "brand-illustration", label: locale === "zh" ? "品牌插画" : "Brand illustration" },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}
