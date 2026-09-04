"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGenerationJobSchema,
  DEFAULT_LINEAR_STROKE_WIDTH_PERCENT,
  DEFAULT_SUBJECT_SIZE_PERCENT,
  DESIGN_SETTINGS_VERSION,
  ICON_STYLE_PRESETS,
  MAX_SUBJECTS,
  OUTPUT_SIZES,
  type ColorSetting,
  type CreateGenerationJobInput,
  type GenerationSettingsResponse,
  type IconStyle,
} from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { Toast, type ToastVariant } from "@/components/ui/toast";
import { CreatePageSkeleton } from "@/components/ui/page-skeletons";
import { AppIconStyleSelector } from "./app-icon-style-selector";
import { IconPurposeSelector, type IconPurpose } from "./icon-purpose-selector";
import { IconSubjectEditor } from "./icon-subject-editor";
import {
  InteractionIconEditor,
  type BackgroundContainer,
  type BackgroundMode,
  type IconStructure,
} from "./interaction-icon-editor";
import { ReferenceSizeSelector } from "./reference-size-selector";
import { parseSubjectRows } from "../subject-parser";
import {
  generationSubjectDraftReducer,
  initialGenerationSubjectDrafts,
} from "../generation-subject-drafts";

const defaultAppIconPreset = ICON_STYLE_PRESETS.find(
  (preset) => preset.id !== "line-icon",
)?.id ?? "isometric-3d";
const defaultStyle: IconStyle = {
  preset: defaultAppIconPreset,
  subjectSizePercent: DEFAULT_SUBJECT_SIZE_PERCENT,
  linearStrokeWidthPercent: DEFAULT_LINEAR_STROKE_WIDTH_PERCENT,
  subjectOpacityPercent: 100,
  strokeWeight: "regular",
  cornerStyle: "balanced",
  detailLevel: "standard",
};
function automaticSubjectBackground(
  mode: BackgroundMode,
  container: BackgroundContainer,
  cornerRadius = 22,
  color?: ColorSetting,
  autoColor = true,
): CreateGenerationJobInput["background"] {
  if (mode === "transparent") return { enabled: false };
  return {
    enabled: true,
    container,
    color: color ??
      (mode === "gradient"
        ? {
            mode: "gradient",
            colors: ["#FFFFFF", "#FFFFFF"],
            direction: "top-left-to-bottom-right",
          }
        : { mode: "solid", color: "#FFFFFF" }),
    autoColor,
    cornerRadius: container === "rounded-square" ? cornerRadius : undefined,
  };
}

export function GenerationForm() {
  const { locale } = useLocale();
  const router = useRouter();
  const [subjectDrafts, dispatchSubjectDraft] = useReducer(
    generationSubjectDraftReducer,
    initialGenerationSubjectDrafts,
  );
  const [iconPurpose, setIconPurpose] = useState<IconPurpose>("interaction");
  const [iconStructure, setIconStructure] = useState<IconStructure>("linear");
  const [subjectColor, setSubjectColor] = useState<ColorSetting>({
    mode: "solid",
    color: "#61666E",
  });
  const [style, setStyle] = useState<IconStyle>(defaultStyle);
  const [sizes, setSizes] = useState<number[]>([64, 128, 256]);
  const [settings, setSettings] = useState<GenerationSettingsResponse | null>(
    null,
  );
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/generation/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setSettings)
      .catch(() =>
        setMessage(
          locale === "zh"
            ? "图标设置加载失败，请刷新页面重试。"
            : "Icon settings could not load. Refresh the page to try again.",
        ),
      )
      .finally(() => setSettingsLoading(false));
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  const subjects = useMemo(
    () =>
      subjectDrafts.flatMap((draft, index) =>
        parseSubjectRows([draft.input]).map((subject) => ({
          ...subject,
          clientId: `subject-${index + 1}`,
          backgroundOverride: automaticSubjectBackground(
            draft.backgroundMode,
            draft.backgroundContainer,
            draft.backgroundCornerRadius ?? 22,
            iconPurpose === "interaction" ? draft.backgroundColor : undefined,
            iconPurpose !== "interaction",
          ),
        })),
      ),
    [iconPurpose, subjectDrafts],
  );
  function updateSubject(index: number, value: string) {
    dispatchSubjectDraft({ type: "update-input", index, value });
  }
  function selectIconPurpose(purpose: IconPurpose) {
    setIconPurpose(purpose);
    if (purpose === "app-icon" && style.preset === "line-icon")
      setStyle((current) => ({ ...current, preset: defaultAppIconPreset }));
  }
  function selectAppStyle(value: IconStyle) {
    setStyle(value);
  }
  function addSubject() {
    dispatchSubjectDraft({ type: "add", maxSubjects: MAX_SUBJECTS });
  }
  function removeSubject(index: number) {
    dispatchSubjectDraft({ type: "remove", index });
  }
  function toggleSize(size: number) {
    if (sizes.includes(size)) {
      setSizes((current) => current.filter((item) => item !== size));
      setMessage("");
      return;
    }
    if (sizes.length >= 3) {
      setToast({
        message:
          locale === "zh"
            ? "最多选择 3 种输出尺寸。"
            : "Choose up to 3 output sizes.",
        variant: "warning",
      });
      return;
    }
    setSizes((current) => [...current, size].sort((a, b) => a - b));
    setMessage("");
  }
  function selectSubjectBackgroundMode(index: number, mode: BackgroundMode) {
    dispatchSubjectDraft({ type: "set-background-mode", index, value: mode });
    const current = subjectDrafts[index]?.backgroundColor;
    if (mode === "solid" && current?.mode === "gradient")
      dispatchSubjectDraft({
        type: "set-background-color",
        index,
        value: { mode: "solid", color: current.colors[0] },
      });
    if (mode === "gradient" && current?.mode === "solid")
      dispatchSubjectDraft({
        type: "set-background-color",
        index,
        value: {
          mode: "gradient",
          colors: [current.color, "#A78BFA"],
          direction: "top-left-to-bottom-right",
        },
      });
  }
  function selectSubjectBackgroundColor(index: number, value: ColorSetting) {
    dispatchSubjectDraft({ type: "set-background-color", index, value });
  }
  function selectSubjectBackgroundContainer(
    index: number,
    container: BackgroundContainer,
  ) {
    dispatchSubjectDraft({
      type: "set-background-container",
      index,
      value: container,
    });
  }
  function selectSubjectBackgroundCornerRadius(index: number, value: number) {
    dispatchSubjectDraft({
      type: "set-background-corner-radius",
      index,
      value,
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    // Kept as the job-level fallback for old readers. Every current subject also
    // carries its own backgroundOverride, which is what the worker prioritizes.
    const background = automaticSubjectBackground(
      subjectDrafts[0]?.backgroundMode ?? "solid",
      subjectDrafts[0]?.backgroundContainer ?? "rounded-square",
      subjectDrafts[0]?.backgroundCornerRadius ?? 22,
      iconPurpose === "interaction"
        ? subjectDrafts[0]?.backgroundColor
        : undefined,
      iconPurpose !== "interaction",
    );
    const parsed = createGenerationJobSchema.safeParse({
      idempotencyKey: crypto.randomUUID(),
      settingsVersion: DESIGN_SETTINGS_VERSION,
      purpose: iconPurpose,
      subjects,
      subjectColor,
      background,
      style: { ...style, graphicStructure: iconStructure },
      sizes,
    });
    if (!parsed.success) {
      const hasSubjects = subjects.length > 0;
      setMessage(
        hasSubjects
          ? locale === "zh"
            ? "部分图标描述不完整，请检查每个输入项后重试。"
            : "Some icon descriptions are incomplete. Review each field and try again."
          : locale === "zh"
            ? "请至少填写一个图标需求再生成。"
            : "Describe at least one icon before generating.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/generation/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "INSUFFICIENT_CREDITS") {
          const required = result.details?.required ?? subjects.length;
          const balance = result.details?.balance;
          throw new Error(
            locale === "zh"
              ? `点数不足：本次需要 ${required} 点，当前${balance === null || balance === undefined ? "余额不足" : `有 ${balance} 点`}。`
              : `Not enough credits: this set needs ${required}, and you ${balance === null || balance === undefined ? "do not have enough" : `have ${balance}`}.`,
          );
        }
        throw new Error(result.message ?? "Generation request failed");
      }
      router.push(`/icons/${result.id}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : locale === "zh"
            ? "任务创建失败。"
            : "Task creation failed.",
      );
      setBusy(false);
    }
  }

  if (settingsLoading) return <CreatePageSkeleton includeHeader={false} />;

  return (
    <form onSubmit={submit} className="generation-studio-form space-y-8">
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
      <section className="creation-config-section">
        <div className="creation-workspace">
          <IconPurposeSelector
            value={iconPurpose}
            onChange={selectIconPurpose}
            locale={locale}
          />
          <div className="creation-workspace__editor">
            {iconPurpose === "interaction" ? (
              <InteractionIconEditor
                locale={locale}
                iconStructure={iconStructure}
                onIconStructureChange={setIconStructure}
                subjectSizePercent={style.subjectSizePercent}
                onSubjectSizePercentChange={(subjectSizePercent) => setStyle((current) => ({ ...current, subjectSizePercent }))}
                linearStrokeWidthPercent={style.linearStrokeWidthPercent}
                onLinearStrokeWidthPercentChange={(linearStrokeWidthPercent) => setStyle((current) => ({ ...current, linearStrokeWidthPercent }))}
                subjectOpacityPercent={style.subjectOpacityPercent}
                onSubjectOpacityPercentChange={(subjectOpacityPercent) => setStyle((current) => ({ ...current, subjectOpacityPercent }))}
                subjectColor={subjectColor}
                onSubjectColorChange={setSubjectColor}
                backgroundMode={subjectDrafts[0]?.backgroundMode ?? "solid"}
                backgroundContainer={subjectDrafts[0]?.backgroundContainer ?? "rounded-square"}
                cornerRadius={subjectDrafts[0]?.backgroundCornerRadius ?? 22}
                backgroundColor={subjectDrafts[0]?.backgroundColor ?? { mode: "solid", color: "#FFFFFF" }}
              />
            ) : (
              <AppIconStyleSelector
                presets={settings?.stylePresets ?? []}
                value={style}
                onChange={selectAppStyle}
                loading={!settings}
                locale={locale}
              />
            )}
          </div>
          <div className="creation-workspace__side">
            <IconSubjectEditor
              values={subjectDrafts.map((draft) => draft.input)}
              onChange={updateSubject}
              onAdd={addSubject}
              onRemove={removeSubject}
              maxSubjects={MAX_SUBJECTS}
              locale={locale}
              backgroundModes={subjectDrafts.map((draft) => draft.backgroundMode)}
              onBackgroundModeChange={selectSubjectBackgroundMode}
              backgroundContainers={subjectDrafts.map((draft) => draft.backgroundContainer)}
              onBackgroundContainerChange={selectSubjectBackgroundContainer}
              backgroundCornerRadii={subjectDrafts.map((draft) => draft.backgroundCornerRadius ?? 22)}
              onBackgroundCornerRadiusChange={selectSubjectBackgroundCornerRadius}
              backgroundColors={iconPurpose === "interaction" ? subjectDrafts.map((draft) => draft.backgroundColor) : undefined}
              onBackgroundColorChange={iconPurpose === "interaction" ? selectSubjectBackgroundColor : undefined}
            />
            <ReferenceSizeSelector
              options={OUTPUT_SIZES}
              selected={sizes}
              onToggle={toggleSize}
              locale={locale}
            />
            <button
              type="submit"
              disabled={busy || !settings}
              className="studio-button studio-button--primary creation-side-submit min-h-12 px-7 font-black disabled:opacity-50"
            >
              {busy
                ? locale === "zh"
                  ? "正在开始生成…"
                  : "Starting generation…"
                : locale === "zh"
                  ? "生成图标"
                  : "Generate icons"}
            </button>
          </div>
        </div>
      </section>
      {message ? (
        <p
          role="alert"
          className="studio-notice studio-notice--error px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
