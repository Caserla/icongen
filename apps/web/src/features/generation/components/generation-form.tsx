"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BACKGROUND_TYPE_OPTION_IDS, createGenerationJobSchema, DESIGN_SETTINGS_VERSION, OUTPUT_SIZES,
  type ColorSetting, type GenerationSettingsResponse, type IconStyle,
} from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";
import { Toast, type ToastVariant } from "@/components/ui/toast";
import { BackgroundPreview } from "./background-preview";

type GradientDirection = Extract<ColorSetting, { mode: "gradient" }>["direction"];
const directions: GradientDirection[] = ["top-to-bottom", "bottom-to-top", "left-to-right", "right-to-left", "top-left-to-bottom-right", "top-right-to-bottom-left", "radial"];
const defaultStyle: IconStyle = { preset: "clay-3d", strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "standard" };
const hexPattern = /^#[0-9A-Fa-f]{6}$/;
const defaultBackgroundType = BACKGROUND_TYPE_OPTION_IDS[0];

function parseSubjects(input: string) {
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const separator = line.search(/[：:]/);
    const explicitName = separator > 0 ? line.slice(0, separator).trim() : line;
    const explicitDescription = separator > 0 ? line.slice(separator + 1).trim() : line;
    return { clientId: `subject-${index + 1}`, name: explicitName.slice(0, 40), description: explicitDescription };
  });
}

function ColorEditor({ value, onChange, locale, fixedMulticolor = false, gradientControls = false }: { value: ColorSetting; onChange: (value: ColorSetting) => void; locale: "en" | "zh"; fixedMulticolor?: boolean; gradientControls?: boolean }) {
  const [colorError, setColorError] = useState("");
  const gradient = value.mode === "gradient" ? value : { mode: "gradient" as const, colors: [value.color, "#A78BFA"] as [string, string], direction: "top-left-to-bottom-right" as const };
  function updateColor(index: number, color: string) {
    if (!hexPattern.test(color)) { setColorError(locale === "zh" ? "请输入 #RRGGBB 格式的颜色值。" : "Enter a color in #RRGGBB format."); return; }
    setColorError("");
    onChange(value.mode === "solid" ? { ...value, color: color.toUpperCase() } : { ...value, colors: index === 0 ? [color.toUpperCase(), value.colors[1]] : [value.colors[0], color.toUpperCase()] });
  }
  return <div className="mt-3 space-y-3">
    {!fixedMulticolor ? <div className="flex gap-2">
      {(["solid", "gradient"] as const).map((mode) => <button key={mode} type="button" onClick={() => onChange(mode === "solid" ? { mode, color: value.mode === "solid" ? value.color : value.colors[0] } : gradient)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${value.mode === mode ? "border-foreground bg-foreground text-white" : "border-border bg-background"}`}>{locale === "zh" ? (mode === "solid" ? "纯色" : "多色") : mode === "solid" ? "Solid" : "Multicolor"}</button>)}
    </div> : null}
    {value.mode === "solid" || gradientControls ? <div className="grid gap-3">
      {(value.mode === "solid" ? [value.color] : value.colors).map((color, index) => { const inputLabel = value.mode === "solid" ? (locale === "zh" ? "颜色值" : "Color value") : index === 0 ? (locale === "zh" ? "渐变颜色一" : "Gradient color 1") : (locale === "zh" ? "渐变颜色二" : "Gradient color 2"); return <label key={index} className="rounded-xl border border-border bg-background p-3 text-sm font-semibold"><span className="mb-2 block">{inputLabel}</span><span className="flex items-center gap-2"><input aria-label={inputLabel} type="color" value={color} onChange={(event) => updateColor(index, event.target.value)} className="h-10 w-12 cursor-pointer border-0 bg-transparent"/><input aria-label={`${inputLabel} HEX`} defaultValue={color.toUpperCase()} onBlur={(event) => { updateColor(index, event.currentTarget.value.trim()); if (!hexPattern.test(event.currentTarget.value.trim())) event.currentTarget.value = color.toUpperCase(); }} placeholder="#RRGGBB" inputMode="text" autoCapitalize="characters" spellCheck={false} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono font-normal uppercase"/></span></label>; })}
    </div> : <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">{locale === "zh" ? "颜色将根据图标内容与所选风格自动生成。" : "Colors are generated automatically from the icon content and selected style."}</p>}
    {value.mode === "gradient" && gradientControls ? <label className="block text-sm font-semibold">{locale === "zh" ? "渐变方向" : "Gradient direction"}<select value={value.direction} onChange={(event) => onChange({ ...value, direction: event.target.value as GradientDirection })} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal">{directions.map((direction) => <option key={direction} value={direction}>{locale === "zh" ? ({ "top-to-bottom": "从上到下", "bottom-to-top": "从下到上", "left-to-right": "从左到右", "right-to-left": "从右到左", "top-left-to-bottom-right": "左上到右下", "top-right-to-bottom-left": "右上到左下", radial: "中心放射" } as Record<string,string>)[direction] : direction.replaceAll("-", " ")}</option>)}</select></label> : null}
    {colorError ? <p role="alert" className="text-sm text-danger">{colorError}</p> : null}
  </div>;
}

function BackgroundGradientEditor({ value, onChange, locale }: { value: Extract<ColorSetting, { mode: "gradient" }>; onChange: (value: ColorSetting) => void; locale: "en" | "zh" }) {
  function updateColor(index: number, color: string) {
    if (!hexPattern.test(color)) return;
    onChange({ ...value, colors: index === 0 ? [color.toUpperCase(), value.colors[1]] : [value.colors[0], color.toUpperCase()] });
  }

  return <div className="grid grid-cols-2 gap-2">
    {value.colors.map((color, index) => { const label = index === 0 ? (locale === "zh" ? "起始颜色" : "Start color") : (locale === "zh" ? "终点颜色" : "End color"); return <label key={index} className="min-w-0"><span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span><span className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-2 py-2"><input aria-label={label} type="color" value={color} onChange={(event) => updateColor(index, event.target.value)} className="h-9 w-9 shrink-0 cursor-pointer border-0 bg-transparent"/><input aria-label={`${label} HEX`} value={color.toUpperCase()} onChange={(event) => updateColor(index, event.target.value.trim())} className="min-w-0 w-full bg-transparent font-mono text-xs uppercase outline-none"/></span></label>; })}
    <label className="relative col-span-2 min-w-0"><span className="sr-only">{locale === "zh" ? "渐变方向" : "Gradient direction"}</span><select aria-label={locale === "zh" ? "渐变方向" : "Gradient direction"} value={value.direction} onChange={(event) => onChange({ ...value, direction: event.target.value as GradientDirection })} className="min-h-11 w-full appearance-none rounded-xl border border-border bg-background py-2 pl-3 pr-10 text-sm">{directions.map((direction) => <option key={direction} value={direction}>{locale === "zh" ? ({ "top-to-bottom": "从上到下", "bottom-to-top": "从下到上", "left-to-right": "从左到右", "right-to-left": "从右到左", "top-left-to-bottom-right": "左上到右下", "top-right-to-bottom-left": "右上到左下", radial: "中心放射" } as Record<string,string>)[direction] : direction.replaceAll("-", " ")}</option>)}</select><svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current text-muted" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 8 4 4 4-4"/></svg></label>
  </div>;
}

function BackgroundSolidEditor({ value, onChange, locale }: { value: Extract<ColorSetting, { mode: "solid" }>; onChange: (value: ColorSetting) => void; locale: "en" | "zh" }) {
  const label = locale === "zh" ? "背景颜色" : "Background color";
  function update(color: string) { if (hexPattern.test(color)) onChange({ mode: "solid", color: color.toUpperCase() }); }
  return <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-2"><input aria-label={label} type="color" value={value.color} onChange={(event) => update(event.target.value)} className="h-9 w-9 shrink-0 cursor-pointer border-0 bg-transparent"/><input aria-label={`${label} HEX`} value={value.color.toUpperCase()} onChange={(event) => update(event.target.value.trim())} className="min-w-0 w-full bg-transparent font-mono text-xs uppercase outline-none"/></label>;
}

export function GenerationForm() {
  const { locale } = useLocale();
  const router = useRouter();
  const [subjectInput, setSubjectInput] = useState("");
  const [subjectColor, setSubjectColor] = useState<ColorSetting>({ mode: "solid", color: "#000000" });
  const [backgroundMode, setBackgroundMode] = useState<"transparent" | "solid" | "gradient">("transparent");
  const [backgroundColor, setBackgroundColor] = useState<ColorSetting>({ mode: "gradient", colors: ["#F2EEFF", "#DDD6FE"], direction: "top-left-to-bottom-right" });
  const [backgroundCornerRadius, setBackgroundCornerRadius] = useState(22);
  const [style, setStyle] = useState<IconStyle>(defaultStyle);
  const [sizes, setSizes] = useState<number[]>([64, 256, 1024]);
  const [settings, setSettings] = useState<GenerationSettingsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/generation/settings").then((response) => response.ok ? response.json() : Promise.reject()).then(setSettings).catch(() => setMessage(locale === "zh" ? "设计设置加载失败，请刷新页面。" : "Design settings failed to load. Refresh the page.")); }, [locale]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), 6000); return () => window.clearTimeout(timeout); }, [toast]);

  const subjects = useMemo(() => parseSubjects(subjectInput), [subjectInput]);
  function toggleSize(size: number) {
    if (sizes.includes(size)) { setSizes((current) => current.filter((item) => item !== size)); setMessage(""); return; }
    if (sizes.length >= 3) { setToast({ message: locale === "zh" ? "参考尺寸最多选择 3 种。" : "Choose up to 3 reference sizes.", variant: "warning" }); return; }
    setSizes((current) => [...current, size].sort((a,b) => a-b)); setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const payload = {
      idempotencyKey: crypto.randomUUID(), settingsVersion: DESIGN_SETTINGS_VERSION,
      subjects,
      subjectColor,
      background: backgroundEnabled ? { enabled: true as const, container: backgroundContainer, color: backgroundColor } : { enabled: false as const },
      style,
      sizes,
    };
    const parsed = createGenerationJobSchema.safeParse(payload);
    if (!parsed.success) { setMessage(locale === "zh" ? "请按每行一个需求填写图标主体，并选择 1–3 种参考尺寸。" : "Enter one icon need per line and choose 1–3 reference sizes."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/generation/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Generation request failed");
      router.push(`/icons/${result.id}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : (locale === "zh" ? "任务创建失败。" : "Task creation failed.")); setBusy(false); }
  }

  const [backgroundContainer, setBackgroundContainer] = useState<(typeof BACKGROUND_TYPE_OPTION_IDS)[number]>(defaultBackgroundType);
  const backgroundEnabled = backgroundMode !== "transparent";
  function selectBackgroundMode(mode: "transparent" | "solid" | "gradient") {
    setBackgroundMode(mode);
    if (mode === "solid" && backgroundColor.mode === "gradient") setBackgroundColor({ mode: "solid", color: "#FFFFFF" });
    if (mode === "gradient" && backgroundColor.mode === "solid") setBackgroundColor({ mode: "gradient", colors: [backgroundColor.color, "#DDD6FE"], direction: "top-left-to-bottom-right" });
  }
  const presets = settings?.stylePresets ?? [];
  return <form onSubmit={submit} className="space-y-8">
    {toast ? <Toast message={toast.message} variant={toast.variant} /> : null}
    <section><h2 className="text-xl font-black">1. {locale === "zh" ? "图标主体" : "Icon subjects"}</h2><p className="mt-1 text-sm text-muted">{locale === "zh" ? "在一个输入框中描述多个图标需求，每行一个；可使用“名称：功能与视觉含义”的格式。" : "Describe multiple icon needs in one field, one per line. Use “Name: function and visual meaning” when helpful."}</p>
      <label className="mt-4 block text-sm font-semibold">{locale === "zh" ? "图标需求" : "Icon needs"}<textarea value={subjectInput} onChange={(event) => setSubjectInput(event.target.value)} rows={5} placeholder={locale === "zh" ? "查找：查找已有内容，使用放大镜隐喻\n新增：创建新内容，使用加号隐喻\n删除：移除内容，使用垃圾桶隐喻\n返回：返回上一页，使用向左箭头" : "Search: find existing content using a magnifier\nAdd: create new content using a plus symbol\nDelete: remove content using a trash can\nBack: return to the previous screen using a left arrow"} className="mt-2 w-full resize-y rounded-2xl border border-border bg-background p-4 font-normal leading-7"/></label>
    </section>

    <section className="border-t border-border pt-8">
      <BackgroundPreview container={backgroundContainer} color={backgroundColor} subjectColor={subjectColor} enabled={backgroundEnabled} cornerRadius={backgroundCornerRadius} locale={locale}>
          <div className="border-b border-border pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-4">
            <h3 className="text-sm font-black">{locale === "zh" ? "主体颜色" : "Icon color"}</h3>
            <ColorEditor value={subjectColor} onChange={setSubjectColor} locale={locale}/>
          </div>
          <div className="md:pl-4">
            <h3 className="text-sm font-black">{locale === "zh" ? "图标背景" : "Icon background"}</h3>
            <div className="mt-3 flex flex-wrap gap-2">{(["transparent", "solid", "gradient"] as const).map((mode) => <button key={mode} type="button" onClick={() => selectBackgroundMode(mode)} className={`rounded-full border px-3 py-2 text-sm font-semibold ${backgroundMode === mode ? "border-foreground bg-foreground text-white" : "border-border"}`}>{locale === "zh" ? ({ transparent: "透明背景", solid: "单色背景", gradient: "渐变背景" } as const)[mode] : ({ transparent: "Transparent", solid: "Solid background", gradient: "Gradient background" } as const)[mode]}</button>)}</div>
            <div aria-hidden={!backgroundEnabled} inert={!backgroundEnabled} className={`mt-3 min-h-40 space-y-3 transition-opacity ${backgroundEnabled ? "opacity-100" : "invisible opacity-0"}`}><div className="inline-flex rounded-xl border border-border bg-surface-muted p-1">{BACKGROUND_TYPE_OPTION_IDS.map((id) => { const selected = backgroundContainer === id; const label = locale === "zh" ? ({ "rounded-square": "圆角", circle: "圆形", square: "方块" } as Record<string,string>)[id] : ({ "rounded-square": "Rounded", circle: "Circular", square: "Square" } as Record<string,string>)[id]; return <button key={id} type="button" aria-pressed={selected} onClick={() => setBackgroundContainer(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${selected ? "bg-background text-brand shadow-sm" : "text-muted hover:text-foreground"}`}>{label}</button>; })}</div>{backgroundContainer === "rounded-square" ? <label className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-3 py-2"><span className="shrink-0 text-xs font-semibold">{locale === "zh" ? "圆角" : "Radius"}</span><input type="range" min="4" max="40" step="1" value={backgroundCornerRadius} onChange={(event) => setBackgroundCornerRadius(Number(event.target.value))} aria-label={locale === "zh" ? "圆角角度" : "Corner radius"} className="min-w-0 flex-1 accent-brand"/><output className="w-9 text-right font-mono text-xs text-muted">{backgroundCornerRadius}%</output></label> : null}{backgroundColor.mode === "gradient" ? <BackgroundGradientEditor value={backgroundColor} onChange={setBackgroundColor} locale={locale}/> : <BackgroundSolidEditor value={backgroundColor} onChange={setBackgroundColor} locale={locale}/>}</div>
          </div>
      </BackgroundPreview>
    </section>

    <section className="border-t border-border pt-8"><h2 className="text-xl font-black">4. {locale === "zh" ? "图标设计风格" : "Icon design style"}</h2><p className="mt-2 text-sm text-muted">{locale === "zh" ? "通过预览为整套图标选择统一的视觉风格。" : "Choose one consistent visual style for the whole icon set."}</p><fieldset className="mt-5"><legend className="text-sm font-bold">{locale === "zh" ? "风格预设" : "Style preset"}</legend><div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{presets.map((preset) => { const selected = style.preset === preset.id; return <button key={preset.id} type="button" aria-pressed={selected} onClick={() => setStyle((current) => ({ ...current, preset: preset.id as IconStyle["preset"] }))} className={`group overflow-hidden rounded-2xl border p-2 text-left transition duration-200 ${selected ? "border-brand bg-[#f2eeff] shadow-[0_3px_0_#6750E8]" : "border-border bg-background hover:-translate-y-0.5 hover:border-[#b8aaf8] hover:shadow-md"}`}><span className="relative block aspect-square overflow-hidden rounded-xl bg-surface-muted"><Image src={preset.previewImage} alt={`${preset.label[locale]} ${locale === "zh" ? "风格预览" : "style preview"}`} fill sizes="(max-width: 640px) 45vw, (max-width: 1280px) 30vw, 22vw" className="object-contain transition duration-300 group-hover:scale-[1.02]"/></span><span className="block px-2 pb-1 pt-3"><span className="flex items-center justify-between gap-2 text-base font-black"><span>{preset.label[locale]}</span>{selected ? <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs text-white">✓</span> : null}</span><span className="mt-1.5 block text-sm font-normal leading-5 text-muted">{preset.description[locale]}</span></span></button>; })}</div></fieldset>{!settings ? <p className="mt-4 text-sm text-muted">{locale === "zh" ? "正在加载图标设计风格…" : "Loading icon design styles…"}</p> : null}</section>

    <section className="border-t border-border pt-8"><h2 className="text-xl font-black">5. {locale === "zh" ? "参考尺寸" : "Reference sizes"}</h2><p className="mt-2 text-sm text-muted">{locale === "zh" ? `支持多选，最多选择 3 种；当前已选 ${sizes.length}/3。` : `Choose multiple sizes, up to 3. Selected ${sizes.length}/3.`}</p><div className="mt-4 flex flex-wrap gap-2">{OUTPUT_SIZES.map((size) => <button key={size} type="button" aria-pressed={sizes.includes(size)} onClick={() => toggleSize(size)} className={`rounded-xl border px-4 py-2 text-sm font-bold ${sizes.includes(size) ? "border-foreground bg-foreground text-white" : "border-border"}`}>{size} × {size}</button>)}</div></section>

    <div className="sticky bottom-4 z-10 flex justify-end"><button type="submit" disabled={busy || !settings} className="min-h-12 rounded-xl bg-brand px-7 font-black text-white shadow-[0_4px_0_#4930c9] disabled:opacity-50">{busy ? (locale === "zh" ? "正在创建任务…" : "Creating task…") : (locale === "zh" ? "生成图标" : "Generate icons")}</button></div>
    {message ? <p role="alert" className="rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-danger">{message}</p> : null}
  </form>;
}
