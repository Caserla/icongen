"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKGROUND_TYPE_OPTION_IDS, createGenerationJobSchema, DESIGN_SETTINGS_VERSION, MAX_SUBJECTS, OUTPUT_SIZES, type ColorSetting, type GenerationSettingsResponse, type IconStyle } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { Toast, type ToastVariant } from "@/components/ui/toast";
import { AppIconStyleSelector } from "./app-icon-style-selector";
import { IconPurposeSelector, type IconPurpose } from "./icon-purpose-selector";
import { IconSubjectEditor } from "./icon-subject-editor";
import { InteractionIconEditor, type BackgroundMode, type IconStructure } from "./interaction-icon-editor";
import { ReferenceSizeSelector } from "./reference-size-selector";
import { parseSubjectRows } from "../subject-parser";

const defaultStyle: IconStyle = { preset: "clay-3d", strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "standard" };
const defaultBackgroundType = BACKGROUND_TYPE_OPTION_IDS[0];

export function GenerationForm() {
  const { locale } = useLocale();
  const router = useRouter();
  const [subjectInputs, setSubjectInputs] = useState([""]);
  const [iconPurpose, setIconPurpose] = useState<IconPurpose>("interaction");
  const [iconStructure, setIconStructure] = useState<IconStructure>("linear");
  const [subjectColor, setSubjectColor] = useState<ColorSetting>({ mode: "solid", color: "#61666E" });
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("transparent");
  const [backgroundColor, setBackgroundColor] = useState<ColorSetting>({ mode: "gradient", colors: ["#FFFFFF", "#FFFFFF"], direction: "top-left-to-bottom-right" });
  const [backgroundCornerRadius, setBackgroundCornerRadius] = useState(22);
  const [backgroundContainer, setBackgroundContainer] = useState<(typeof BACKGROUND_TYPE_OPTION_IDS)[number]>(defaultBackgroundType);
  const [style, setStyle] = useState<IconStyle>(defaultStyle);
  const [sizes, setSizes] = useState<number[]>([64, 128, 256]);
  const [settings, setSettings] = useState<GenerationSettingsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/generation/settings", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then(setSettings)
      .catch(() => setMessage(locale === "zh" ? "设计设置加载失败，请刷新页面。" : "Design settings failed to load. Refresh the page."));
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const subjects = useMemo(() => parseSubjectRows(subjectInputs), [subjectInputs]);
  function updateSubject(index: number, value: string) {
    setSubjectInputs((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  }
  function addSubject() {
    if (subjectInputs.length >= MAX_SUBJECTS) return;
    setSubjectInputs((current) => [...current, ""]);
  }
  function removeSubject(index: number) {
    setSubjectInputs((current) => current.length === 1 ? [""] : current.filter((_, itemIndex) => itemIndex !== index));
  }
  function toggleSize(size: number) {
    if (sizes.includes(size)) {
      setSizes((current) => current.filter((item) => item !== size));
      setMessage("");
      return;
    }
    if (sizes.length >= 3) {
      setToast({ message: locale === "zh" ? "参考尺寸最多选择 3 种。" : "Choose up to 3 reference sizes.", variant: "warning" });
      return;
    }
    setSizes((current) => [...current, size].sort((a, b) => a - b));
    setMessage("");
  }
  function selectBackgroundMode(mode: BackgroundMode) {
    setBackgroundMode(mode);
    if (mode === "solid" && backgroundColor.mode === "gradient") setBackgroundColor({ mode: "solid", color: "#FFFFFF" });
    if (mode === "gradient" && backgroundColor.mode === "solid") setBackgroundColor({ mode: "gradient", colors: ["#FFFFFF", "#FFFFFF"], direction: "top-left-to-bottom-right" });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const background = iconPurpose === "app-icon"
      ? { enabled: true as const, container: "rounded-square" as const, color: { mode: "solid" as const, color: "#FFFFFF" }, cornerRadius: 22 }
      : backgroundMode !== "transparent"
        ? { enabled: true as const, container: backgroundContainer, color: backgroundColor, cornerRadius: backgroundContainer === "rounded-square" ? backgroundCornerRadius : undefined }
        : { enabled: false as const };
    const parsed = createGenerationJobSchema.safeParse({
      idempotencyKey: crypto.randomUUID(), settingsVersion: DESIGN_SETTINGS_VERSION, purpose: iconPurpose, subjects, subjectColor,
      background,
      style: { ...style, graphicStructure: iconStructure }, sizes,
    });
    if (!parsed.success) {
      const hasSubjects = subjects.length > 0;
      setMessage(hasSubjects
        ? (locale === "zh" ? "部分图标主体格式不完整，请检查填写内容。" : "Some icon subjects are incomplete. Check the entered content.")
        : (locale === "zh" ? "请至少填写一个图标主体的描述。" : "Describe at least one icon subject."));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/generation/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Generation request failed");
      router.push(`/icons/${result.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (locale === "zh" ? "任务创建失败。" : "Task creation failed."));
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-8">
    {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    <section>
      <h2 className="text-xl font-black">1. {locale === "zh" ? "图标用途" : "Icon purpose"}</h2>
      <p className="mt-1 text-sm text-muted">{locale === "zh" ? "选择图标在产品中的用途，仅显示对应的设计设置。" : "Choose how the icon will be used to show only the relevant design settings."}</p>
      <IconPurposeSelector value={iconPurpose} onChange={setIconPurpose} locale={locale}/>
      {iconPurpose === "interaction" ? <InteractionIconEditor
        locale={locale} iconStructure={iconStructure} onIconStructureChange={setIconStructure}
        subjectColor={subjectColor} onSubjectColorChange={setSubjectColor}
        backgroundMode={backgroundMode} onBackgroundModeChange={selectBackgroundMode}
        backgroundColor={backgroundColor} onBackgroundColorChange={setBackgroundColor}
        backgroundContainer={backgroundContainer} onBackgroundContainerChange={setBackgroundContainer}
        cornerRadius={backgroundCornerRadius} onCornerRadiusChange={setBackgroundCornerRadius}
      /> : <AppIconStyleSelector presets={settings?.stylePresets ?? []} value={style} onChange={setStyle} loading={!settings} locale={locale}/>}
    </section>
    <IconSubjectEditor values={subjectInputs} onChange={updateSubject} onAdd={addSubject} onRemove={removeSubject} maxSubjects={MAX_SUBJECTS} locale={locale}/>
    <ReferenceSizeSelector options={OUTPUT_SIZES} selected={sizes} onToggle={toggleSize} locale={locale}/>
    <div className="sticky bottom-4 z-10 flex justify-end"><button type="submit" disabled={busy || !settings} className="min-h-12 rounded-xl bg-brand px-7 font-black text-white shadow-[0_4px_0_#4930c9] disabled:opacity-50">{busy ? (locale === "zh" ? "正在创建任务…" : "Creating task…") : (locale === "zh" ? "生成图标" : "Generate icons")}</button></div>
    {message ? <p role="alert" className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-danger">{message}</p> : null}
  </form>;
}
