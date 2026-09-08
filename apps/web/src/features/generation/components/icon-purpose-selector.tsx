import { StudioSegmentedControl } from "./studio-segmented-control";

export type IconPurpose = "interaction" | "app-icon";

export function IconPurposeSelector({
  value,
  onChange,
  locale,
}: {
  value: IconPurpose;
  onChange: (value: IconPurpose) => void;
  locale: "en" | "zh";
}) {
  const options = (["interaction", "app-icon"] as const).map((purpose) => ({
    value: purpose,
    label:
      locale === "zh"
        ? purpose === "interaction"
          ? "交互图标"
          : "插画图标"
        : purpose === "interaction"
          ? "Interaction icons"
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
    </div>
  );
}
