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
  type IllustrationSubset,
  type IllustrationComposition,
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

const defaultAppIconPreset =
  ICON_STYLE_PRESETS.find((preset) => preset.id !== "line-icon")?.id ??
  "isometric-3d";
const illustrationBackgroundDefaults: Record<
  Exclude<IconStyle["preset"], "line-icon">,
  { solid: ColorSetting; gradient: ColorSetting }
> = {
  "isometric-3d": {
    solid: { mode: "solid", color: "#344A5E" },
    gradient: {
      mode: "gradient",
      colors: ["#1E2B3A", "#536B78"],
      direction: "top-left-to-bottom-right",
    },
  },
  neon: {
    solid: { mode: "solid", color: "#101A46" },
    gradient: {
      mode: "gradient",
      colors: ["#07142F", "#3B176D"],
      direction: "top-left-to-bottom-right",
    },
  },
  "low-poly": {
    solid: { mode: "solid", color: "#334C5A" },
    gradient: {
      mode: "gradient",
      colors: ["#1D2E38", "#526B75"],
      direction: "top-left-to-bottom-right",
    },
  },
  "clay-3d": {
    solid: { mode: "solid", color: "#FFF1DA" },
    gradient: {
      mode: "gradient",
      colors: ["#FFF4E5", "#DDEBFF"],
      direction: "top-left-to-bottom-right",
    },
  },
  "flat-playful": {
    solid: { mode: "solid", color: "#FFE59A" },
    gradient: {
      mode: "gradient",
      colors: ["#FFF4C7", "#FFD6DF"],
      direction: "top-left-to-bottom-right",
    },
  },
  "pixel-art": {
    solid: { mode: "solid", color: "#5D557A" },
    gradient: {
      mode: "gradient",
      colors: ["#3B355E", "#78668F"],
      direction: "top-left-to-bottom-right",
    },
  },
  "flat-illustration": {
    solid: { mode: "solid", color: "#FFF0C2" },
    gradient: {
      mode: "gradient",
      colors: ["#FFF6D8", "#D7F0E2"],
      direction: "top-left-to-bottom-right",
    },
  },
  "cute-sticker": {
    solid: { mode: "solid", color: "#DFF4FF" },
    gradient: {
      mode: "gradient",
      colors: ["#EAF8FF", "#E8DEFF"],
      direction: "top-left-to-bottom-right",
    },
  },
  "minimal-logo": {
    solid: { mode: "solid", color: "#FFF0D9" },
    gradient: {
      mode: "gradient",
      colors: ["#FFF5E8", "#DDEBFF"],
      direction: "top-left-to-bottom-right",
    },
  },
};

// Edge-anchored previews occupy more of the canvas than the centered set, so
// they use a quieter, composition-specific palette that supports their edge
// contrast without competing with the subject. Manual colors are never
// replaced by these defaults.
const edgeAnchoredIllustrationBackgroundDefaults: Record<
  Exclude<IconStyle["preset"], "line-icon">,
  { solid: ColorSetting; gradient: ColorSetting }
> = {
  "isometric-3d": {
    solid: { mode: "solid", color: "#263D59" },
    gradient: {
      mode: "gradient",
      colors: ["#17283D", "#3C5872"],
      direction: "top-left-to-bottom-right",
    },
  },
  neon: {
    solid: { mode: "solid", color: "#090F2D" },
    gradient: {
      mode: "gradient",
      colors: ["#070B24", "#25104A"],
      direction: "top-left-to-bottom-right",
    },
  },
  "low-poly": {
    solid: { mode: "solid", color: "#24383B" },
    gradient: {
      mode: "gradient",
      colors: ["#17272C", "#35504E"],
      direction: "top-left-to-bottom-right",
    },
  },
  "clay-3d": {
    solid: { mode: "solid", color: "#E8E1F5" },
    gradient: {
      mode: "gradient",
      colors: ["#F4EAF2", "#CBD4EE"],
      direction: "top-left-to-bottom-right",
    },
  },
  "flat-playful": {
    solid: { mode: "solid", color: "#FFF0C7" },
    gradient: {
      mode: "gradient",
      colors: ["#FFF4D6", "#DDF3E9"],
      direction: "top-left-to-bottom-right",
    },
  },
  "pixel-art": {
    solid: { mode: "solid", color: "#172B4D" },
    gradient: {
      mode: "gradient",
      colors: ["#0E1D38", "#294667"],
      direction: "top-left-to-bottom-right",
    },
  },
  "flat-illustration": {
    solid: { mode: "solid", color: "#DCE8EE" },
    gradient: {
      mode: "gradient",
      colors: ["#EAF2F3", "#CFDFE9"],
      direction: "top-left-to-bottom-right",
    },
  },
  "cute-sticker": {
    solid: { mode: "solid", color: "#DDF3F8" },
    gradient: {
      mode: "gradient",
      colors: ["#EAF8FA", "#E4E1F7"],
      direction: "top-left-to-bottom-right",
    },
  },
  "minimal-logo": {
    solid: { mode: "solid", color: "#D6E9EC" },
    gradient: {
      mode: "gradient",
      colors: ["#E5F3F3", "#C6DCE8"],
      direction: "top-left-to-bottom-right",
    },
  },
};

function illustrationBackgroundDefault(
  preset: IconStyle["preset"],
  mode: "solid" | "gradient",
  composition: IllustrationComposition = "centered",
) {
  const resolvedPreset: Exclude<IconStyle["preset"], "line-icon"> =
    preset === "line-icon" ? "isometric-3d" : preset;
  const defaults =
    composition === "edge-anchored"
      ? edgeAnchoredIllustrationBackgroundDefaults
      : illustrationBackgroundDefaults;
  return defaults[resolvedPreset][mode];
}
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
    color:
      color ??
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
  const [interactionSubjectDrafts, dispatchInteractionSubjectDraft] =
    useReducer(generationSubjectDraftReducer, initialGenerationSubjectDrafts);
  const [illustrationSubjectDrafts, dispatchIllustrationSubjectDraft] =
    useReducer(generationSubjectDraftReducer, initialGenerationSubjectDrafts);
  const [iconPurpose, setIconPurpose] = useState<IconPurpose>("interaction");
  const [illustrationSubset, setIllustrationSubset] =
    useState<IllustrationSubset>("general");
  const [iconStructure, setIconStructure] = useState<IconStructure>("linear");
  const [interactionSubjectSizePercent, setInteractionSubjectSizePercent] =
    useState<number>(DEFAULT_SUBJECT_SIZE_PERCENT);
  const [subjectColor, setSubjectColor] = useState<ColorSetting>({
    mode: "solid",
    color: "#61666E",
  });
  const [style, setStyle] = useState<IconStyle>(defaultStyle);
  const [sizes, setSizes] = useState<number[]>([24, 64, 128]);
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
  const subjectDrafts =
    iconPurpose === "interaction"
      ? interactionSubjectDrafts
      : illustrationSubjectDrafts;
  const dispatchSubjectDraft =
    iconPurpose === "interaction"
      ? dispatchInteractionSubjectDraft
      : dispatchIllustrationSubjectDraft;

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
          illustrationComposition: draft.illustrationComposition,
          backgroundOverride: automaticSubjectBackground(
            draft.backgroundMode,
            draft.backgroundContainer,
            draft.backgroundCornerRadius ?? 22,
            draft.backgroundColor,
            !draft.backgroundColorCustomized,
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
    subjectDrafts.forEach((draft, index) => {
      if (
        draft.backgroundMode !== "transparent" &&
        !draft.backgroundColorCustomized
      )
        dispatchSubjectDraft({
          type: "set-background-color",
          index,
          value: illustrationBackgroundDefault(
            value.preset,
            draft.backgroundMode,
            draft.illustrationComposition,
          ),
          customized: false,
        });
    });
  }
  function addSubject() {
    dispatchSubjectDraft({
      type: "add",
      maxSubjects: MAX_SUBJECTS,
      backgroundMode: iconPurpose === "interaction" ? "transparent" : "solid",
      backgroundColor:
        iconPurpose === "interaction"
          ? undefined
          : illustrationBackgroundDefault(style.preset, "solid", "centered"),
    });
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
    if (iconPurpose === "app-icon" && mode !== "transparent") {
      dispatchSubjectDraft({
        type: "set-background-color",
        index,
        value: illustrationBackgroundDefault(
          style.preset,
          mode,
          subjectDrafts[index]?.illustrationComposition,
        ),
        customized: false,
      });
      return;
    }
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
    dispatchSubjectDraft({
      type: "set-background-color",
      index,
      value,
      customized: true,
    });
  }
  function selectSubjectBackgroundAutoColor(index: number, value: boolean) {
    dispatchSubjectDraft({
      type: "set-background-auto-color",
      index,
      value,
    });
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
  function selectIllustrationComposition(
    index: number,
    value: IllustrationComposition,
  ) {
    dispatchSubjectDraft({
      type: "set-illustration-composition",
      index,
      value,
    });
    const draft = subjectDrafts[index];
    if (
      iconPurpose === "app-icon" &&
      draft &&
      draft.backgroundMode !== "transparent" &&
      !draft.backgroundColorCustomized
    ) {
      dispatchSubjectDraft({
        type: "set-background-color",
        index,
        value: illustrationBackgroundDefault(
          style.preset,
          draft.backgroundMode,
          value,
        ),
        customized: false,
      });
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    // Kept as the job-level fallback for old readers. Every current subject also
    // carries its own backgroundOverride, which is what the worker prioritizes.
    const background = automaticSubjectBackground(
      subjectDrafts[0]?.backgroundMode ?? "transparent",
      subjectDrafts[0]?.backgroundContainer ?? "rounded-square",
      subjectDrafts[0]?.backgroundCornerRadius ?? 22,
      subjectDrafts[0]?.backgroundColor,
      !(subjectDrafts[0]?.backgroundColorCustomized ?? false),
    );
    const parsed = createGenerationJobSchema.safeParse({
      idempotencyKey: crypto.randomUUID(),
      settingsVersion: DESIGN_SETTINGS_VERSION,
      purpose: iconPurpose,
      illustrationSubset:
        iconPurpose === "app-icon" ? illustrationSubset : "general",
      subjects,
      subjectColor,
      background,
      style: {
        ...style,
        graphicStructure: iconStructure,
        subjectSizePercent:
          iconPurpose === "interaction"
            ? interactionSubjectSizePercent
            : style.subjectSizePercent,
      },
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
            illustrationSubset={illustrationSubset}
            onIllustrationSubsetChange={setIllustrationSubset}
          />
          <div className="creation-workspace__editor">
            {iconPurpose === "interaction" ? (
              <InteractionIconEditor
                locale={locale}
                iconStructure={iconStructure}
                onIconStructureChange={setIconStructure}
                subjectSizePercent={interactionSubjectSizePercent}
                onSubjectSizePercentChange={(subjectSizePercent) =>
                  setInteractionSubjectSizePercent(subjectSizePercent)
                }
                linearStrokeWidthPercent={style.linearStrokeWidthPercent}
                onLinearStrokeWidthPercentChange={(linearStrokeWidthPercent) =>
                  setStyle((current) => ({
                    ...current,
                    linearStrokeWidthPercent,
                  }))
                }
                subjectOpacityPercent={style.subjectOpacityPercent}
                onSubjectOpacityPercentChange={(subjectOpacityPercent) =>
                  setStyle((current) => ({ ...current, subjectOpacityPercent }))
                }
                subjectColor={subjectColor}
                onSubjectColorChange={setSubjectColor}
                backgroundMode={
                  subjectDrafts[0]?.backgroundMode ?? "transparent"
                }
                backgroundContainer={
                  subjectDrafts[0]?.backgroundContainer ?? "rounded-square"
                }
                cornerRadius={subjectDrafts[0]?.backgroundCornerRadius ?? 22}
                backgroundColor={
                  subjectDrafts[0]?.backgroundColor ?? {
                    mode: "solid",
                    color: "#FFFFFF",
                  }
                }
              />
            ) : (
              <AppIconStyleSelector
                presets={settings?.stylePresets ?? []}
                value={style}
                onChange={selectAppStyle}
                loading={!settings}
                locale={locale}
                backgroundMode={
                  subjectDrafts[0]?.backgroundMode ?? "transparent"
                }
                backgroundContainer={
                  subjectDrafts[0]?.backgroundContainer ?? "rounded-square"
                }
                backgroundColor={
                  subjectDrafts[0]?.backgroundColor ?? {
                    mode: "solid",
                    color: "#FFFFFF",
                  }
                }
                cornerRadius={subjectDrafts[0]?.backgroundCornerRadius ?? 22}
                illustrationComposition={
                  subjectDrafts[0]?.illustrationComposition ?? "centered"
                }
              />
            )}
          </div>
          <div className="creation-workspace__side">
            <IconSubjectEditor
              subjectKind={
                iconPurpose === "app-icon" ? illustrationSubset : "general"
              }
              values={subjectDrafts.map((draft) => draft.input)}
              subjectSizePercent={
                iconPurpose === "app-icon"
                  ? style.subjectSizePercent
                  : undefined
              }
              onSubjectSizePercentChange={
                iconPurpose === "app-icon"
                  ? (subjectSizePercent) =>
                      setStyle((current) => ({
                        ...current,
                        subjectSizePercent,
                      }))
                  : undefined
              }
              onChange={updateSubject}
              onAdd={addSubject}
              onRemove={removeSubject}
              maxSubjects={MAX_SUBJECTS}
              locale={locale}
              backgroundModes={subjectDrafts.map(
                (draft) => draft.backgroundMode,
              )}
              onBackgroundModeChange={selectSubjectBackgroundMode}
              backgroundContainers={subjectDrafts.map(
                (draft) => draft.backgroundContainer,
              )}
              onBackgroundContainerChange={selectSubjectBackgroundContainer}
              backgroundCornerRadii={subjectDrafts.map(
                (draft) => draft.backgroundCornerRadius ?? 22,
              )}
              onBackgroundCornerRadiusChange={
                selectSubjectBackgroundCornerRadius
              }
              backgroundColors={subjectDrafts.map(
                (draft) => draft.backgroundColor,
              )}
              onBackgroundColorChange={selectSubjectBackgroundColor}
              backgroundAutoColors={subjectDrafts.map(
                (draft) => !draft.backgroundColorCustomized,
              )}
              onBackgroundAutoColorChange={selectSubjectBackgroundAutoColor}
              illustrationCompositions={
                iconPurpose === "app-icon"
                  ? subjectDrafts.map((draft) => draft.illustrationComposition)
                  : undefined
              }
              onIllustrationCompositionChange={
                iconPurpose === "app-icon"
                  ? selectIllustrationComposition
                  : undefined
              }
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
      {message ? <Toast message={message} variant="error" /> : null}
    </form>
  );
}
