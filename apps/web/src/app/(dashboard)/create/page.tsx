"use client";
import { GenerationForm } from "@/features/generation/components/generation-form";
import { useLocale } from "@/components/i18n/locale-provider";
export default function CreatePage(){const{locale}=useLocale();return <div><p className="draft-label mb-3 text-accent">NEW PROJECT / ICON SYSTEM</p><h1 className="display-serif text-4xl tracking-[-.045em] sm:text-5xl">{locale==="zh"?"创建你的 UI 图标集":"Build your UI icon set"}</h1><p className="mt-3 max-w-3xl leading-7 text-muted">{locale==="zh"?"逐个添加图标主体，统一设置规格，自动为每个主体生成 3 种方案。":"Add one icon subject at a time, apply shared settings, and generate three options for each."}</p><section className="paper-panel mt-8 rounded-[7px] border border-border p-5 shadow-[4px_4px_0_rgba(11,23,50,.12)] sm:p-7"><GenerationForm/></section></div>}
