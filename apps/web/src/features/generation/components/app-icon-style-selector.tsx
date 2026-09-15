import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { IconPreviewGrid } from "./icon-preview-grid";
import {
  backgroundPreviewRadius,
  backgroundPreviewStyle,
} from "./background-preview";
import type {
  ColorSetting,
  GenerationSettingsResponse,
  IconStyle,
  IllustrationComposition,
} from "@icongen/shared";
import type {
  BackgroundContainer,
  BackgroundMode,
} from "./interaction-icon-editor";

// The source previews have different amounts of transparent padding. These
// values normalize their visible bounds to the interaction icon's silhouette,
// so the same subject-size setting has the same perceived size in both modes.
const previewCanvasScale: Partial<Record<IconStyle["preset"], number>> = {
  "isometric-3d": 0.965,
  neon: 0.87,
  "low-poly": 0.885,
  "clay-3d": 1.02,
  "flat-playful": 0.86,
  "pixel-art": 0.85,
  "flat-illustration": 0.84,
  "cute-sticker": 0.825,
  "minimal-logo": 0.93,
};

const edgeAnchoredPreviewImages: Partial<Record<IconStyle["preset"], string>> =
  {
    "flat-illustration":
      "/images/icon-style-previews/edge-anchored-2026-09-10/flat-illustration.png",
    "cute-sticker":
      "/images/icon-style-previews/edge-anchored-2026-09-10/cute-sticker.png",
    "pixel-art":
      "/images/icon-style-previews/edge-anchored-2026-09-10/pixel-art.png",
    neon: "/images/icon-style-previews/edge-anchored-2026-09-10/neon.png",
    "minimal-logo":
      "/images/icon-style-previews/edge-anchored-2026-09-10/minimal-logo.png",
    "flat-playful":
      "/images/icon-style-previews/edge-anchored-2026-09-10/flat-playful.png",
    "low-poly":
      "/images/icon-style-previews/edge-anchored-2026-09-10/low-poly.png",
    "isometric-3d":
      "/images/icon-style-previews/edge-anchored-2026-09-10/isometric-3d.png",
    "clay-3d":
      "/images/icon-style-previews/edge-anchored-2026-09-10/clay-3d.png",
  };

const fullBleedPreviewImages: Partial<Record<IconStyle["preset"], string>> = {
  "flat-illustration":
    "/images/icon-style-previews/full-bleed-2026-09-11/flat-illustration.png",
  "cute-sticker":
    "/images/icon-style-previews/full-bleed-2026-09-11/cute-sticker.png",
  "pixel-art":
    "/images/icon-style-previews/full-bleed-2026-09-11/pixel-art.png",
  neon: "/images/icon-style-previews/full-bleed-2026-09-11/neon.png",
  "minimal-logo":
    "/images/icon-style-previews/full-bleed-2026-09-11/minimal-logo.png",
  "flat-playful":
    "/images/icon-style-previews/full-bleed-2026-09-11/flat-playful.png",
  "low-poly":
    "/images/icon-style-previews/full-bleed-2026-09-11/low-poly.png",
  "isometric-3d":
    "/images/icon-style-previews/full-bleed-2026-09-11/isometric-3d.png",
  "clay-3d":
    "/images/icon-style-previews/full-bleed-2026-09-11/clay-3d.png",
};

export function AppIconStyleSelector({
  presets,
  value,
  onChange,
  loading,
  locale,
  backgroundMode,
  backgroundContainer,
  backgroundColor,
  cornerRadius,
  illustrationComposition,
}: {
  presets: GenerationSettingsResponse["stylePresets"];
  value: IconStyle;
  onChange: (value: IconStyle) => void;
  loading: boolean;
  locale: "en" | "zh";
  backgroundMode: BackgroundMode;
  backgroundContainer: BackgroundContainer;
  backgroundColor: ColorSetting;
  cornerRadius: number;
  illustrationComposition: IllustrationComposition;
}) {
  const appIconPresets = presets.filter((preset) => preset.id !== "line-icon");
  const selectedPreset =
    appIconPresets.find((preset) => preset.id === value.preset) ??
    appIconPresets[0];
  const previewImageFor = (preset: (typeof appIconPresets)[number]) => {
    const presetId = preset.id as IconStyle["preset"];
    if (illustrationComposition === "full-bleed-scene") {
      return fullBleedPreviewImages[presetId] ?? preset.previewImage;
    }
    if (illustrationComposition === "edge-anchored") {
      return edgeAnchoredPreviewImages[presetId] ?? preset.previewImage;
    }
    return preset.previewImage;
  };
  const effectiveBackgroundColor: ColorSetting =
    backgroundMode === "gradient"
      ? backgroundColor.mode === "gradient"
        ? backgroundColor
        : {
            mode: "gradient",
            colors: [backgroundColor.color, "#A78BFA"],
            direction: "top-left-to-bottom-right",
          }
      : backgroundColor.mode === "solid"
        ? backgroundColor
        : { mode: "solid", color: backgroundColor.colors[0] };
  const normalizedSubjectSize = Math.min(
    100,
    value.subjectSizePercent * (previewCanvasScale[value.preset] ?? 1) * 1.3,
  );
  return (
    <div className="illustration-editor mt-6">
      <div className="illustration-editor__canvas">
        <div className="creation-editor__toolbar">
          <span>STYLE PREVIEW</span>
          <span>1024 × 1024</span>
        </div>
        <div className="illustration-editor__stage">
          {selectedPreset ? (
            <IconPreviewGrid className="creation-editor__preview illustration-editor__preview">
              <div
                aria-label={
                  locale === "zh"
                    ? "插画背景实时预览图"
                    : "Live illustration background preview"
                }
                className="illustration-background-preview flex aspect-square h-full w-full items-center justify-center transition-[border-radius] duration-200"
                style={
                  backgroundMode === "transparent"
                    ? { background: "transparent", borderRadius: 0 }
                    : {
                        ...backgroundPreviewStyle(effectiveBackgroundColor),
                        borderRadius: backgroundPreviewRadius(
                          backgroundContainer,
                          cornerRadius,
                        ),
                      }
                }
              >
                <ImageWithSkeleton
                  src={previewImageFor(selectedPreset)}
                  alt={`${selectedPreset.label[locale]} ${locale === "zh" ? "风格预览" : "style preview"}`}
                  className="transition-[width,height] duration-200"
                  imageClassName="h-full w-full object-contain"
                  imageStyle={{ objectFit: "contain" }}
                  style={{
                    width: `${normalizedSubjectSize}%`,
                    height: `${normalizedSubjectSize}%`,
                    transform:
                      illustrationComposition === "full-bleed-scene"
                        ? "scale(1.18)"
                        : undefined,
                    transformOrigin: "center",
                  }}
                  failureLabel={
                    locale === "zh" ? "预览加载失败" : "Preview failed to load"
                  }
                />
              </div>
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
                    src={previewImageFor(preset)}
                    alt={`${preset.label[locale]} ${locale === "zh" ? "风格预览" : "style preview"}`}
                    className="h-full w-full"
                    imageClassName={previewClass}
                    imageStyle={{
                      objectFit: "contain",
                      objectPosition: "center",
                    }}
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
