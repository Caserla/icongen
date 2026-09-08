"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppIconBackgroundSettings } from "./app-icon-background-settings";
import {
  MAX_SUBJECT_DESCRIPTION_LENGTH,
  type ColorSetting,
} from "@icongen/shared";
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
  const [expandedBackgroundIndex, setExpandedBackgroundIndex] = useState<
    number | null
  >(null);
  const [expandedSubjectIndex, setExpandedSubjectIndex] = useState<
    number | null
  >(null);
  const subjectListRef = useRef<HTMLDivElement>(null);
  const subjectEditorRef = useRef<HTMLDivElement>(null);
  const subjectTriggerRefs = useRef(new Map<number, HTMLButtonElement>());
  const [subjectEditorRect, setSubjectEditorRect] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const pendingAddRef = useRef(false);
  useEffect(() => {
    if (!pendingAddRef.current) return;
    pendingAddRef.current = false;
    const list = subjectListRef.current;
    requestAnimationFrame(() => {
      list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      setExpandedSubjectIndex(values.length - 1);
    });
  }, [values.length]);
  useEffect(() => {
    if (expandedSubjectIndex === null) return;
    const positionEditor = () => {
      const trigger = subjectTriggerRefs.current.get(expandedSubjectIndex);
      const rect = trigger?.getBoundingClientRect();
      const rowRect = trigger
        ?.closest<HTMLElement>(".icon-subject-row")
        ?.getBoundingClientRect();
      if (rect)
        setSubjectEditorRect({
          left: rect.left,
          top: rect.top,
          width: rowRect?.width ?? rect.width,
        });
    };
    positionEditor();
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!subjectEditorRef.current?.contains(event.target as Node))
        setExpandedSubjectIndex(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedSubjectIndex(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", positionEditor);
    window.addEventListener("scroll", positionEditor, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionEditor);
      window.removeEventListener("scroll", positionEditor, true);
    };
  }, [expandedSubjectIndex]);
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
      meta={
        <span className="icon-subject-count">
          {values.length} / {maxSubjects}
        </span>
      }
    >
      <div ref={subjectListRef} className="icon-subject-list mt-4 space-y-3">
        {values.map((value, index) => (
          <div key={index} className="studio-panel p-3">
            <div className="icon-subject-row">
              <div className="icon-subject-field">
                <span className="sr-only">
                  {locale === "zh"
                    ? `图标主体 ${index + 1}`
                    : `Icon subject ${index + 1}`}
                </span>
                <button
                  ref={(node) => {
                    if (node) subjectTriggerRefs.current.set(index, node);
                    else subjectTriggerRefs.current.delete(index);
                  }}
                  type="button"
                  onClick={(event) => {
                    setExpandedBackgroundIndex(null);
                    const list = subjectListRef.current;
                    const row =
                      event.currentTarget.closest<HTMLElement>(".studio-panel");
                    if (list && row) {
                      const listRect = list.getBoundingClientRect();
                      const rowRect = row.getBoundingClientRect();
                      list.scrollTo({
                        top: list.scrollTop + rowRect.top - listRect.top,
                        behavior: "smooth",
                      });
                    }
                    const rect = event.currentTarget.getBoundingClientRect();
                    const rowRect = event.currentTarget
                      .closest<HTMLElement>(".icon-subject-row")
                      ?.getBoundingClientRect();
                    setSubjectEditorRect({
                      left: rect.left,
                      top: rect.top,
                      width: rowRect?.width ?? rect.width,
                    });
                    setExpandedSubjectIndex(index);
                  }}
                  className="icon-subject-input min-h-12 w-full px-4 text-left"
                  aria-haspopup="dialog"
                  aria-expanded={expandedSubjectIndex === index}
                >
                  <span
                    className={value.trim() ? "" : "icon-subject-placeholder"}
                  >
                    {value.trim() ||
                      (locale === "zh"
                        ? "输入你想生成的图标…"
                        : "Type what you want to create…")}
                  </span>
                </button>
              </div>
              {hasBackgroundSettings ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSubjectIndex(null);
                    setExpandedBackgroundIndex((current) =>
                      current === index ? null : index,
                    );
                  }}
                  className="icon-subject-more grid h-12 w-12 shrink-0 place-items-center"
                  aria-expanded={expandedBackgroundIndex === index}
                  aria-label={
                    locale === "zh"
                      ? `设置第 ${index + 1} 个图标背景`
                      : `Configure background for icon ${index + 1}`
                  }
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-current"
                  >
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
          closeLabel={
            locale === "zh" ? "关闭背景设置" : "Close background settings"
          }
          onClose={() => setExpandedBackgroundIndex(null)}
          className={`icon-background-dialog--mode-${backgroundModes[expandedBackgroundIndex] ?? "solid"}${backgroundColors ? " icon-background-dialog--manual-colors" : ""}`}
        >
          <AppIconBackgroundSettings
            mode={backgroundModes[expandedBackgroundIndex] ?? "solid"}
            onModeChange={(mode) =>
              onBackgroundModeChange(expandedBackgroundIndex, mode)
            }
            container={
              backgroundContainers[expandedBackgroundIndex] ?? "rounded-square"
            }
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
        className="studio-button studio-button--secondary studio-subject-add mt-4 min-h-11 px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
      >
        + {locale === "zh" ? "再添加一个图标" : "Add another icon"}
      </button>
      {expandedSubjectIndex !== null && subjectEditorRect
        ? createPortal(
            <div
              ref={subjectEditorRef}
              role="dialog"
              aria-label={
                locale === "zh"
                  ? `编辑图标主体 ${expandedSubjectIndex + 1}`
                  : `Edit icon subject ${expandedSubjectIndex + 1}`
              }
              className="icon-subject-editor-popover icon-subject-editor-popover--portal"
              style={subjectEditorRect}
            >
              <textarea
                autoFocus
                value={values[expandedSubjectIndex] ?? ""}
                maxLength={MAX_SUBJECT_DESCRIPTION_LENGTH}
                onChange={(event) =>
                  onChange(expandedSubjectIndex, event.target.value)
                }
                placeholder={
                  locale === "zh"
                    ? "详细描述你想生成的图标…"
                    : "Describe the icon you want to create…"
                }
                className="icon-subject-editor-textarea"
              />
              <span className="icon-subject-editor-count">
                {(values[expandedSubjectIndex] ?? "").length} /{" "}
                {MAX_SUBJECT_DESCRIPTION_LENGTH}
              </span>
            </div>,
            document.body,
          )
        : null}
    </StudioSideCard>
  );
}
