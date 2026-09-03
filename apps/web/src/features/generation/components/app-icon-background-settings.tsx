import type {
  BackgroundContainer,
  BackgroundMode,
} from "./interaction-icon-editor";

export function AppIconBackgroundSettings({
  mode,
  onModeChange,
  container,
  onContainerChange,
  cornerRadius,
  onCornerRadiusChange,
  locale,
}: {
  mode: BackgroundMode;
  onModeChange: (mode: BackgroundMode) => void;
  container: BackgroundContainer;
  onContainerChange: (container: BackgroundContainer) => void;
  cornerRadius: number;
  onCornerRadiusChange: (cornerRadius: number) => void;
  locale: "en" | "zh";
}) {
  return (
    <section className="rounded-[6px] border border-border bg-background p-4">
      <h3 className="text-sm font-black">
        {locale === "zh" ? "图标背景" : "Icon background"}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["transparent", "solid", "gradient"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => onModeChange(option)}
            className="draft-option px-3 py-2 text-sm font-semibold"
          >
            {locale === "zh"
              ? (
                  {
                    transparent: "透明背景",
                    solid: "单色背景",
                    gradient: "渐变背景",
                  } as const
                )[option]
              : (
                  {
                    transparent: "Transparent",
                    solid: "Solid background",
                    gradient: "Gradient background",
                  } as const
                )[option]}
          </button>
        ))}
      </div>
      {mode !== "transparent" ? (
        <div className="mt-3 space-y-3">
          <div
            className="flex flex-wrap gap-2"
            aria-label={locale === "zh" ? "背景形状" : "Background shape"}
          >
            {(["rounded-square", "circle", "square"] as const).map((shape) => (
              <button
                key={shape}
                type="button"
                aria-pressed={container === shape}
                onClick={() => onContainerChange(shape)}
                className="draft-option px-3 py-2 text-xs font-semibold"
              >
                {locale === "zh"
                  ? ({ "rounded-square": "圆角", circle: "圆形", square: "方块" } as const)[shape]
                  : ({ "rounded-square": "Rounded", circle: "Circle", square: "Square" } as const)[shape]}
              </button>
            ))}
          </div>
          {container === "rounded-square" ? (
            <label className="draft-control flex w-full max-w-md items-center gap-3 bg-surface-muted px-3 py-2">
              <span className="shrink-0 text-xs font-semibold">
                {locale === "zh" ? "圆角角度" : "Corner radius"}
              </span>
              <input
                type="range"
                min="4"
                max="40"
                value={cornerRadius}
                onChange={(event) =>
                  onCornerRadiusChange(Number(event.target.value))
                }
                className="min-w-0 flex-1 accent-brand"
                aria-label={locale === "zh" ? "圆角角度" : "Corner radius"}
              />
              <div className="flex shrink-0 items-center gap-1">
                <input
                  type="number"
                  min="4"
                  max="40"
                  value={cornerRadius}
                  onChange={(event) =>
                    onCornerRadiusChange(
                      Math.min(40, Math.max(4, Number(event.target.value))),
                    )
                  }
                  aria-label={
                    locale === "zh"
                      ? "圆角角度数值"
                      : "Corner radius value"
                  }
                  className="draft-control h-8 w-14 px-2 text-right font-mono text-xs"
                />
                <span className="text-xs text-muted">%</span>
              </div>
            </label>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        {locale === "zh"
          ? "背景配色将根据图标内容与所选风格自动生成。"
          : "Background colors are generated automatically from the icon content and selected style."}
      </p>
    </section>
  );
}
