"use client";

import { useEffect, useRef, useState } from "react";
import { AppIconBackgroundSettings } from "./app-icon-background-settings";
import { MAX_SUBJECT_DESCRIPTION_LENGTH, type ColorSetting } from "@icongen/shared";
import type {
  BackgroundContainer,
  BackgroundMode,
} from "./interaction-icon-editor";
import { StudioDrawer } from "./studio-drawer";
import { StudioSideCard } from "./studio-side-card";

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
  backgroundColors,
  onBackgroundColorChange,
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
  backgroundColors?: ColorSetting[];
  onBackgroundColorChange?: (index: number, value: ColorSetting) => void;
}) {
  const [expandedBackgroundIndex, setExpandedBackgroundIndex] = useState<number | null>(null);
  const subjectListRef = useRef<HTMLDivElement>(null);
  const pendingAddRef = useRef(false);
  useEffect(() => {
    if (!pendingAddRef.current) return;
    pendingAddRef.current = false;
    const list = subjectListRef.current;
    const inputs = list?.querySelectorAll<HTMLInputElement>(".icon-subject-input");
    const latestInput = inputs?.[inputs.length - 1];
    requestAnimationFrame(() => {
      list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      latestInput?.focus({ preventScroll: true });
    });
  }, [values.length]);
  const hasBackgroundSettings = Boolean(
    backgroundModes &&
      onBackgroundModeChange &&
      backgroundContainers &&
      onBackgroundContainerChange &&
      backgroundCornerRadii &&
      onBackgroundCornerRadiusChange,
  );
  return (
    <StudioSideCard
      className="creation-side-card--subjects"
      title={locale === "zh" ? "图标主体" : "Icon subjects"}
      meta={<span className="icon-subject-count">{values.length} / {maxSubjects}</span>}
      description={locale === "zh" ? "每个输入项描述一个图标；需要更多图标时继续添加。" : "Describe one icon per field. Add another field for each additional icon."}
    >
      <div ref={subjectListRef} className="icon-subject-list mt-4 space-y-3">
        {values.map((value, index) => (
          <div key={index} className="studio-panel p-3">
            <div className="flex items-center gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">
                  {locale === "zh"
                    ? `图标主体 ${index + 1}`
                    : `Icon subject ${index + 1}`}
                </span>
                <input
                  value={value}
                  maxLength={MAX_SUBJECT_DESCRIPTION_LENGTH}
                  onChange={(event) => onChange(index, event.target.value)}
                  placeholder={locale === "zh" ? "输入你想生成的图标…" : "Type what you want to create…"}
                  className="icon-subject-input min-h-12 w-full px-4"
                />
              </label>
              {hasBackgroundSettings ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBackgroundIndex((current) =>
                      current === index ? null : index,
                    )
                  }
                  className="icon-subject-more grid h-12 w-12 shrink-0 place-items-center"
                  aria-expanded={expandedBackgroundIndex === index}
                  aria-label={
                    locale === "zh"
                      ? `设置第 ${index + 1} 个图标背景`
                      : `Configure background for icon ${index + 1}`
                  }
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
              ) : null}
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    onRemove(index);
                    setExpandedBackgroundIndex((current) =>
                      current === null
                        ? null
                        : current === index
                          ? null
                          : current > index
                            ? current - 1
                            : current,
                    );
                  }}
                  className="studio-button studio-button--primary icon-subject-remove min-h-12 px-4 text-sm"
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
          </div>
        ))}
      </div>
      {expandedBackgroundIndex !== null &&
      backgroundModes &&
      onBackgroundModeChange &&
      backgroundContainers &&
      onBackgroundContainerChange &&
      backgroundCornerRadii &&
      onBackgroundCornerRadiusChange ? (
        <StudioDrawer
          title={locale === "zh" ? "图标背景" : "Icon background"}
          closeLabel={locale === "zh" ? "关闭背景设置" : "Close background settings"}
          onClose={() => setExpandedBackgroundIndex(null)}
          className={`icon-background-dialog--mode-${backgroundModes[expandedBackgroundIndex] ?? "solid"}${backgroundColors ? " icon-background-dialog--manual-colors" : ""}`}
        >
            <AppIconBackgroundSettings
              mode={backgroundModes[expandedBackgroundIndex] ?? "solid"}
              onModeChange={(mode) => onBackgroundModeChange(expandedBackgroundIndex, mode)}
              container={backgroundContainers[expandedBackgroundIndex] ?? "rounded-square"}
              onContainerChange={(container) =>
                onBackgroundContainerChange(expandedBackgroundIndex, container)
              }
              cornerRadius={backgroundCornerRadii[expandedBackgroundIndex] ?? 22}
              onCornerRadiusChange={(value) =>
                onBackgroundCornerRadiusChange(expandedBackgroundIndex, value)
              }
              locale={locale}
              color={backgroundColors?.[expandedBackgroundIndex]}
              onColorChange={
                onBackgroundColorChange
                  ? (value) =>
                      onBackgroundColorChange(expandedBackgroundIndex, value)
                  : undefined
              }
            />
        </StudioDrawer>
      ) : null}
      <button
        type="button"
        onClick={() => {
          pendingAddRef.current = true;
          onAdd();
        }}
        disabled={values.length >= maxSubjects}
        className="mt-4 min-h-11 rounded-[4px] border border-brand px-5 text-sm font-bold text-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        + {locale === "zh" ? "再添加一个图标" : "Add another icon"}
      </button>
    </StudioSideCard>
  );
}
