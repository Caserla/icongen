"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKGROUND_TYPE_OPTION_IDS, createGenerationJobSchema, DESIGN_SETTINGS_VERSION, OUTPUT_SIZES, type ColorSetting, type GenerationSettingsResponse, type IconStyle } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { Toast, type ToastVariant } from "@/components/ui/toast";
import { AppIconStyleSelector } from "./app-icon-style-selector";
import { IconPurposeSelector, type IconPurpose } from "./icon-purpose-selector";
import { IconSubjectEditor } from "./icon-subject-editor";
import { InteractionIconEditor, type BackgroundMode, type IconStructure } from "./interaction-icon-editor";
import { ReferenceSizeSelector } from "./reference-size-selector";

const defaultStyle: IconStyle = { preset: "clay-3d", strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "standard" };
const defaultBackgroundType = BACKGROUND_TYPE_OPTION_IDS[0];

function parseSubjects(input: string) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const separator = line.search(/[：:]/);
    const name = separator > 0 ? line.slice(0, separator).trim() : line;
    const description = separator > 0 ? line.slice(separator + 1).trim() : line;
    return { clientId: `subject-${index + 1}`, name: name.slice(0, 40), description };
  });
}

export function GenerationForm() {
  const { locale } = useLocale();
  const router = useRouter();
  const [subjectInput, setSubjectInput] = useState("");
  const [iconPurpose, setIconPurpose] = useState<IconPurpose>("interaction");
  const [iconStructure, setIconStructure] = useState<IconStructure>("linear");
  const [subjectColor, setSubjectColor] = useState<ColorSetting>({ mode: "solid", color: "#46474A" });
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("transparent");
  const [backgroundColor, setBackgroundColor] = useState<ColorSetting>({ mode: "gradient", colors: ["#F2EEFF", "#DDD6FE"], direction: "top-left-to-bottom-right" });
  const [backgroundCornerRadius, setBackgroundCornerRadius] = useState(22);
  const [backgroundContainer, setBackgroundContainer] = useState<(typeof BACKGROUND_TYPE_OPTION_IDS)[number]>(defaultBackgroundType);
  const [style, setStyle] = useState<IconStyle>(defaultStyle);
  const [sizes, setSizes] = useState<number[]>([64, 256, 1024]);
  const [settings, setSettings] = useState<GenerationSettingsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/generation/settings").then((response) => response.ok ? response.json() : Promise.reject()).then(setSettings)
      .catch(() => setMessage(locale === "zh" ? "设计设置加载失败，请刷新页面。" : "Design settings failed to load. Refresh the page."));
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const subjects = useMemo(() => parseSubjects(subjectInput), [subjectInput]);
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
    if (mode === "gradient" && backgroundColor.mode === "solid") setBackgroundColor({ mode: "gradient", colors: [backgroundColor.color, "#DDD6FE"], direction: "top-left-to-bottom-right" });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const parsed = createGenerationJobSchema.safeParse({
      idempotencyKey: crypto.randomUUID(), settingsVersion: DESIGN_SETTINGS_VERSION, purpose: iconPurpose, subjects, subjectColor,
      background: backgroundMode !== "transparent" ? { enabled: true as const, container: backgroundContainer, color: backgroundColor } : { enabled: false as const },
      style: { ...style, graphicStructure: iconStructure }, sizes,
    });
    if (!parsed.success) {
      setMessage(locale === "zh" ? "请至少填写一个图标主体的描述。" : "Describe at least one icon subject.");
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
    <IconSubjectEditor value={subjectInput} onChange={setSubjectInput} locale={locale}/>
    <ReferenceSizeSelector options={OUTPUT_SIZES} selected={sizes} onToggle={toggleSize} locale={locale}/>
    <div className="sticky bottom-4 z-10 flex justify-end"><button type="submit" disabled={busy || !settings} className="min-h-12 rounded-xl bg-brand px-7 font-black text-white shadow-[0_4px_0_#4930c9] disabled:opacity-50">{busy ? (locale === "zh" ? "正在创建任务…" : "Creating task…") : (locale === "zh" ? "生成图标" : "Generate icons")}</button></div>
    {message ? <p role="alert" className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-danger">{message}</p> : null}
  </form>;
}
