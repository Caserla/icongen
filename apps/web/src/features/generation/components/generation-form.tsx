"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BACKGROUND_TYPE_OPTION_IDS,
  createGenerationJobSchema,
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
  strokeWeight: "regular",
  cornerStyle: "balanced",
  detailLevel: "standard",
};
const defaultBackgroundType = BACKGROUND_TYPE_OPTION_IDS[0];

function automaticAppBackground(
  mode: BackgroundMode,
  container: BackgroundContainer,
  cornerRadius = 22,
): CreateGenerationJobInput["background"] {
  if (mode === "transparent") return { enabled: false };
  return {
    enabled: true,
    container,
    color:
      mode === "gradient"
        ? {
            mode: "gradient",
            colors: ["#FFFFFF", "#FFFFFF"],
            direction: "top-left-to-bottom-right",
          }
        : { mode: "solid", color: "#FFFFFF" },
    autoColor: true,
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
  const [backgroundMode, setBackgroundMode] =
    useState<BackgroundMode>("transparent");
  const [backgroundColor, setBackgroundColor] = useState<ColorSetting>({
    mode: "gradient",
    colors: ["#FFFFFF", "#FFFFFF"],
    direction: "top-left-to-bottom-right",
  });
  const [backgroundCornerRadius, setBackgroundCornerRadius] = useState(22);
  const [backgroundContainer, setBackgroundContainer] = useState<
    (typeof BACKGROUND_TYPE_OPTION_IDS)[number]
  >(defaultBackgroundType);
  const [style, setStyle] = useState<IconStyle>(defaultStyle);
  const [sizes, setSizes] = useState<number[]>([64, 128, 256]);
  const [settings, setSettings] = useState<GenerationSettingsResponse | null>(
    null,
  );
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
      );
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
          ...(iconPurpose === "app-icon"
            ? {
                backgroundOverride: automaticAppBackground(
                  draft.backgroundMode,
                  draft.backgroundContainer,
                  draft.backgroundCornerRadius ?? 22,
                ),
              }
            : {}),
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
  function selectBackgroundMode(mode: BackgroundMode) {
    setBackgroundMode(mode);
    if (mode === "solid" && backgroundColor.mode === "gradient")
      setBackgroundColor({ mode: "solid", color: "#FFFFFF" });
    if (mode === "gradient" && backgroundColor.mode === "solid")
      setBackgroundColor({
        mode: "gradient",
        colors: ["#FFFFFF", "#FFFFFF"],
        direction: "top-left-to-bottom-right",
      });
  }
  function selectAppBackgroundMode(index: number, mode: BackgroundMode) {
    dispatchSubjectDraft({ type: "set-background-mode", index, value: mode });
  }
  function selectAppBackgroundContainer(
    index: number,
    container: BackgroundContainer,
  ) {
    dispatchSubjectDraft({
      type: "set-background-container",
      index,
      value: container,
    });
  }
  function selectAppBackgroundCornerRadius(index: number, value: number) {
    dispatchSubjectDraft({
      type: "set-background-corner-radius",
      index,
      value,
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const background =
      iconPurpose === "app-icon"
        ? automaticAppBackground(
            subjectDrafts[0]?.backgroundMode ?? "solid",
            subjectDrafts[0]?.backgroundContainer ?? "rounded-square",
            subjectDrafts[0]?.backgroundCornerRadius ?? 22,
          )
        : backgroundMode !== "transparent"
          ? {
              enabled: true as const,
              container: backgroundContainer,
              color: backgroundColor,
              cornerRadius:
                backgroundContainer === "rounded-square"
                  ? backgroundCornerRadius
                  : undefined,
            }
          : { enabled: false as const };
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
            ? "请至少描述一个图标后再生成。"
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
      if (!response.ok)
        throw new Error(result.message ?? "Generation request failed");
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

  return (
    <form onSubmit={submit} className="space-y-8">
      {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
      <section>
        <h2 className="text-xl font-black">
          1. {locale === "zh" ? "图标用途" : "Icon purpose"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {locale === "zh"
            ? "选择图标的使用场景，页面将显示对应设置。"
            : "Choose where the icons will be used. We will show the settings that apply."}
        </p>
        <IconPurposeSelector
          value={iconPurpose}
          onChange={selectIconPurpose}
          locale={locale}
        />
        {iconPurpose === "interaction" ? (
          <InteractionIconEditor
            locale={locale}
            iconStructure={iconStructure}
            onIconStructureChange={setIconStructure}
            subjectColor={subjectColor}
            onSubjectColorChange={setSubjectColor}
            backgroundMode={backgroundMode}
            onBackgroundModeChange={selectBackgroundMode}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
            backgroundContainer={backgroundContainer}
            onBackgroundContainerChange={setBackgroundContainer}
            cornerRadius={backgroundCornerRadius}
            onCornerRadiusChange={setBackgroundCornerRadius}
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
      </section>
      <IconSubjectEditor
        values={subjectDrafts.map((draft) => draft.input)}
        onChange={updateSubject}
        onAdd={addSubject}
        onRemove={removeSubject}
        maxSubjects={MAX_SUBJECTS}
        locale={locale}
        backgroundModes={
          iconPurpose === "app-icon"
            ? subjectDrafts.map((draft) => draft.backgroundMode)
            : undefined
        }
        onBackgroundModeChange={
          iconPurpose === "app-icon" ? selectAppBackgroundMode : undefined
        }
        backgroundContainers={
          iconPurpose === "app-icon"
            ? subjectDrafts.map((draft) => draft.backgroundContainer)
            : undefined
        }
        onBackgroundContainerChange={
          iconPurpose === "app-icon" ? selectAppBackgroundContainer : undefined
        }
        backgroundCornerRadii={
          iconPurpose === "app-icon"
            ? subjectDrafts.map((draft) => draft.backgroundCornerRadius)
                .map((value) => value ?? 22)
            : undefined
        }
        onBackgroundCornerRadiusChange={
          iconPurpose === "app-icon"
            ? selectAppBackgroundCornerRadius
            : undefined
        }
      />
      <ReferenceSizeSelector
        options={OUTPUT_SIZES}
        selected={sizes}
        onToggle={toggleSize}
        locale={locale}
      />
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button
          type="submit"
          disabled={busy || !settings}
          className="min-h-12 rounded-xl bg-brand px-7 font-black text-white shadow-[0_4px_0_#4930c9] disabled:opacity-50"
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
      {message ? (
        <p
          role="alert"
          className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-danger"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
