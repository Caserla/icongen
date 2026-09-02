import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
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
  return (
    <div className="mt-6">
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">
          {locale === "zh" ? "风格预设" : "Style preset"}
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {appIconPresets.map((preset) => {
            const selected = value.preset === preset.id;
          const previewClass = "object-contain transition duration-300 group-hover:scale-[1.02]";
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
                className={`group overflow-hidden rounded-2xl border p-2 text-left transition duration-200 ${selected ? "border-brand bg-[#f2eeff] shadow-[0_3px_0_#6750E8]" : "border-border bg-background hover:-translate-y-0.5 hover:border-[#b8aaf8] hover:shadow-md"}`}
              >
                <span
              className="relative block aspect-square overflow-hidden rounded-xl bg-surface-muted"
                >
                  <ImageWithSkeleton
                    src={preset.previewImage}
                    alt={`${preset.label[locale]} ${locale === "zh" ? "风格预览" : "style preview"}`}
                    className="h-full w-full"
                    imageClassName={previewClass}
                    failureLabel={locale === "zh" ? "预览加载失败" : "Preview failed to load"}
                  />
                </span>
                <span className="block px-2 pb-1 pt-3">
                  <span className="flex items-center justify-between gap-2 text-base font-black">
                    <span>{preset.label[locale]}</span>
                    {selected ? (
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs text-white"
                      >
                        ✓
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1.5 block text-sm font-normal leading-5 text-muted">
                    {preset.description[locale]}
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
