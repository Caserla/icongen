"use client";

import { useState } from "react";
import { createGenerationJobSchema, DESIGN_SETTINGS_VERSION } from "@icongen/shared";
import { useLocale } from "@/components/i18n/locale-provider";

const presets = ["Neutral", "Rounded", "Bold", "Playful", "Technical"];

export function GenerationForm() {
  const { locale } = useLocale();
  const [description, setDescription] = useState("");
  const [visualTone, setVisualTone] = useState("neutral");
  const [message, setMessage] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createGenerationJobSchema.safeParse({
      idempotencyKey: crypto.randomUUID(), settingsVersion: DESIGN_SETTINGS_VERSION,
      subjects: [{ clientId: crypto.randomUUID(), name: description.trim().slice(0, 40) || "Icon", description }],
      subjectColor: { mode: "solid", color: "#6750E8" }, background: { enabled: false },
      coreSettings: { graphicStructure: "outline", visualTone, strokeWeight: "regular", colorMode: "monochrome", backgroundContainer: "none", detailLevel: "auto" },
      sizes: [256],
    });
    setMessage(result.success ? (locale === "zh" ? "设置已通过新版任务协议验证。" : "The settings pass the current job contract.") : (locale === "zh" ? "请至少输入 2 个字符。" : "Please enter at least 2 characters."));
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block text-sm font-semibold">
        {locale === "zh" ? "图标主体描述（当前为过渡表单）" : "Icon subject description (temporary form)"}
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} maxLength={1000} placeholder={locale === "zh" ? "一款帮助远程团队专注的计时器，使用简洁的日出符号和温暖配色……" : "A calm focus timer for remote teams, using a simple sunrise symbol and warm colors…"} className="focus-ring mt-2 w-full resize-y rounded-[16px] border border-border bg-background p-4 font-normal leading-7" />
      </label>
      <fieldset>
        <legend className="text-sm font-semibold">{locale === "zh" ? "视觉气质" : "Visual tone"}</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <label key={preset} className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-muted">
              <input type="radio" name="visualTone" value={preset.toLowerCase()} checked={visualTone === preset.toLowerCase()} onChange={(event) => setVisualTone(event.target.value)} className="mr-2" />{locale === "zh" ? ({Neutral:"中性",Rounded:"圆润",Bold:"醒目",Playful:"活泼",Technical:"技术感"} as Record<string,string>)[preset] : preset}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-sm text-muted">{locale === "zh" ? "每个图标主体固定生成 3 个方案。" : "Each icon subject creates exactly 3 variants."}</p>
        <button type="submit" className="focus-ring min-h-13 rounded-xl bg-brand px-6 font-black text-white shadow-[0_4px_0_#4930c9] active:translate-y-[3px] active:shadow-[0_1px_0_#4930c9]">{locale === "zh" ? "检查图标描述" : "Check icon description"}</button>
      </div>
      {message ? <p role="status" className="rounded-xl bg-surface-muted px-4 py-3 text-sm">{message}</p> : null}
    </form>
  );
}
