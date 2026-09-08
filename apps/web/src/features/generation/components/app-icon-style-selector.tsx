import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { IconPreviewGrid } from "./icon-preview-grid";
import type { GenerationSettingsResponse, IconStyle } from "@icongen/shared";

export function AppIconStyleSelector({
  presets,
  value,
  onChange,
  loading,
  locale,
}: {
  presets: GenerationSettingsResponse["stylePresets"];
  value: IconStyle;
  onChange: (value: IconStyle) => void;
  loading: boolean;
  locale: "en" | "zh";
}) {
  const appIconPresets = presets.filter((preset) => preset.id !== "line-icon");
  const selectedPreset =
    appIconPresets.find((preset) => preset.id === value.preset) ??
    appIconPresets[0];
  return (
    <div className="illustration-editor mt-6">
      <div className="illustration-editor__canvas">
        <div className="creation-editor__toolbar">
          <span>STYLE PREVIEW</span>
          <span>1024 × 1024</span>
        </div>
        <div className="illustration-editor__stage">
          {selectedPreset ? (
            <IconPreviewGrid className="illustration-editor__preview">
            <ImageWithSkeleton
              src={selectedPreset.previewImage}
              alt={`${selectedPreset.label[locale]} ${locale === "zh" ? "风格预览" : "style preview"}`}
              className="h-full w-full rounded-[24%]"
              imageClassName="h-full w-full object-cover"
              failureLabel={
                locale === "zh" ? "预览加载失败" : "Preview failed to load"
              }
            />
            </IconPreviewGrid>
          ) : null}
        </div>
      </div>
      <fieldset className="illustration-editor__controls">
        <legend className="sr-only">
          {locale === "zh" ? "风格预设" : "Style preset"}
        </legend>
        <div className="creation-editor__controls-head">
          <span>{locale === "zh" ? "风格预设" : "STYLE PRESET"}</span>
        </div>
        <div className="illustration-editor__options">
          {appIconPresets.map((preset) => {
            const selected = value.preset === preset.id;
            const previewClass = "object-contain";
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onChange({
                    ...value,
                    preset: preset.id as IconStyle["preset"],
                  })
                }
                className={`illustration-editor__option group text-left ${selected ? "is-selected" : ""}`}
              >
                <span className="relative block aspect-square overflow-hidden rounded-[10px] bg-transparent">
                  <ImageWithSkeleton
                    src={preset.previewImage}
                    alt={`${preset.label[locale]} ${locale === "zh" ? "风格预览" : "style preview"}`}
                    className="h-full w-full"
                    imageClassName={previewClass}
                    failureLabel={
                      locale === "zh"
                        ? "预览加载失败"
                        : "Preview failed to load"
                    }
                  />
                </span>
                <span className="block px-2 pb-1 pt-3">
                  <span className="flex items-center justify-between gap-2 text-base font-black">
                    <span>{preset.label[locale]}</span>
                    {selected ? (
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f5f5f5] text-[#171717]"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="block h-5 w-5 fill-none stroke-current"
                          strokeWidth="2.2"
                          strokeLinecap="square"
                          strokeLinejoin="miter"
                        >
                          <path d="m4.5 12.5 5 5 10-10" />
                        </svg>
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {loading ? (
        <p className="mt-4 text-sm text-muted">
          {locale === "zh"
            ? "正在加载图标设计风格…"
            : "Loading icon design styles…"}
        </p>
      ) : null}
    </div>
  );
}
