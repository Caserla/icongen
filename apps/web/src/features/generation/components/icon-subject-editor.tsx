import { AppIconBackgroundSettings } from "./app-icon-background-settings";
import type {
  BackgroundContainer,
  BackgroundMode,
} from "./interaction-icon-editor";

export function IconSubjectEditor({
  values,
  onChange,
  onAdd,
  onRemove,
  maxSubjects,
  locale,
  backgroundModes,
  onBackgroundModeChange,
  backgroundContainers,
  onBackgroundContainerChange,
  backgroundCornerRadii,
  onBackgroundCornerRadiusChange,
}: {
  values: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  maxSubjects: number;
  locale: "en" | "zh";
  backgroundModes?: BackgroundMode[];
  onBackgroundModeChange?: (index: number, mode: BackgroundMode) => void;
  backgroundContainers?: BackgroundContainer[];
  onBackgroundContainerChange?: (
    index: number,
    container: BackgroundContainer,
  ) => void;
  backgroundCornerRadii?: number[];
  onBackgroundCornerRadiusChange?: (index: number, value: number) => void;
}) {
  return (
    <section className="border-t border-border pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">
            2. {locale === "zh" ? "图标主体" : "Icon subjects"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {locale === "zh"
              ? "每个输入项描述一个图标；需要更多图标时继续添加。"
              : "Describe one icon per field. Add another field for each additional icon."}
          </p>
        </div>
        <span className="text-sm text-muted">
          {values.length} / {maxSubjects}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {values.map((value, index) => (
          <div key={index} className="rounded-2xl border border-border p-3">
            <div className="flex items-center gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">
                  {locale === "zh"
                    ? `图标主体 ${index + 1}`
                    : `Icon subject ${index + 1}`}
                </span>
                <input
                  value={value}
                  onChange={(event) => onChange(index, event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-border bg-background px-4"
                />
              </label>
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="min-h-12 rounded-xl border border-border px-4 text-sm font-bold text-muted"
                  aria-label={
                    locale === "zh"
                      ? `删除第 ${index + 1} 个图标`
                      : `Remove icon ${index + 1}`
                  }
                >
                  {locale === "zh" ? "删除" : "Remove"}
                </button>
              ) : null}
            </div>
            {backgroundModes &&
            onBackgroundModeChange &&
            backgroundContainers &&
            onBackgroundContainerChange &&
            backgroundCornerRadii &&
            onBackgroundCornerRadiusChange ? (
              <div className="mt-3">
                <AppIconBackgroundSettings
                  mode={backgroundModes[index] ?? "solid"}
                  onModeChange={(mode) => onBackgroundModeChange(index, mode)}
                  container={backgroundContainers[index] ?? "rounded-square"}
                  onContainerChange={(container) =>
                    onBackgroundContainerChange(index, container)
                  }
                  cornerRadius={backgroundCornerRadii[index] ?? 22}
                  onCornerRadiusChange={(value) =>
                    onBackgroundCornerRadiusChange(index, value)
                  }
                  locale={locale}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={values.length >= maxSubjects}
        className="mt-4 min-h-11 rounded-xl border border-brand px-5 text-sm font-bold text-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        + {locale === "zh" ? "再添加一个图标" : "Add another icon"}
      </button>
    </section>
  );
}
