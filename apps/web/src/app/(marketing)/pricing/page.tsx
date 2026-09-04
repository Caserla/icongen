"use client";

import { ButtonLink } from "@/components/ui/button-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { PRICING_PACKS } from "@/lib/pricing-packs";

export default function PricingPage() {
  const { locale } = useLocale();
  const zh = locale === "zh";

  return (
    <main className="pricing-studio min-h-[calc(100vh-72px)]">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:pt-20">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="display-serif text-4xl font-medium tracking-[-.05em] text-[#fffaf0] sm:text-6xl">
          {zh ? "没挑中？那就再来一版" : "Not quite right? Take another shot"}
        </h1>
      </header>

      <section className="mt-14 grid items-stretch gap-7 lg:grid-cols-2" aria-label={zh ? "点数套餐" : "Credit packs"}>
        {PRICING_PACKS.map((pack) => {
          const featured = "featured" in pack && pack.featured;
          return (
            <article key={pack.id} className={`studio-panel relative flex min-h-[370px] flex-col overflow-hidden p-7 sm:p-8 ${featured ? "border-white/30" : ""}`}>
              {featured ? <span className="absolute right-0 top-0 rounded-bl-[6px] bg-brand px-4 py-2 text-xs font-black tracking-[.08em] text-white">{zh ? "选这档的人最多" : "THE FAVOURITE"}</span> : null}
              <div>
                <p className="text-sm font-black tracking-[.08em] text-brand">{pack.name[zh ? "zh" : "en"]}</p>
                <div className="mt-8 flex items-end gap-2 border-b border-border/70 pb-7">
                  <strong className="text-5xl font-black tracking-[-.07em] text-foreground">{pack.price}</strong>
                  <span className="pb-1 text-sm font-semibold text-muted">{zh ? "买断" : "one-time"}</span>
                </div>
              </div>
              <div className="mt-7 flex items-center justify-between gap-3">
                <div><strong className="text-3xl font-black text-foreground">{pack.credits}</strong><span className="ml-2 text-sm font-bold text-muted">{zh ? "点" : "credits"}</span></div>
                <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-muted">{zh ? `一个图标 ${pack.unitPrice}` : `${pack.unitPrice} an icon`}</span>
              </div>
              <p className="mt-6 text-base leading-7 text-muted">{pack.description[zh ? "zh" : "en"]}</p>
              <p className="mt-5 text-sm font-black text-foreground">{zh ? `${pack.credits} 个图标，每个先出 3 版` : `${pack.credits} icons, with 3 options for each`}</p>
              <ButtonLink href="/account/credits" variant={featured ? "primary" : "secondary"} className={`mt-auto !mt-12 min-h-13 w-full text-base ${featured ? "shadow-[0_4px_0_#1d2e60]" : ""}`}>
                {zh ? "使用 CD-Key 充值" : "Redeem a CD-Key"}<span aria-hidden="true" className="ml-2">→</span>
              </ButtonLink>
            </article>
          );
        })}
      </section>

      <section className="mt-10 rounded-[8px] border border-white/15 bg-white/[.07] p-7 text-[#fffaf0] backdrop-blur-sm sm:p-9" aria-label={zh ? "每个套餐都包含" : "Included with every pack"}>
        <h2 className="text-center text-sm font-black tracking-[.1em] text-white/70">{zh ? "每个套餐都有这些" : "INCLUDED WITH EVERY PACK"}</h2>
        <div className="mt-7 grid gap-6 sm:grid-cols-3">
          <Benefit title={zh ? "生成失败，免费重试" : "Failed generation? Retry free"} copy={zh ? "失败的方案可以重新生成，不会重复扣点。" : "Failed options can be regenerated without another charge."} />
          <Benefit title={zh ? "小细节，接着改" : "Fix the small details"} copy={zh ? "每个方案都送 3 次细节调整，用完再定稿。" : "Every option includes 3 detail edits before you call it done."} />
          <Benefit title={zh ? "需要的尺寸，一起拿走" : "Take every size you need"} copy={zh ? "原图和常用尺寸可以一起打包下载。" : "Download the original and common sizes in one package."} />
        </div>
      </section>
        <p className="mt-7 text-center text-sm text-white/60">{zh ? "当前仅支持 CD-Key 充值，其他收款充值方式待定。生成失败不扣点，也不占免费调整次数。" : "CD-Key redemption is currently supported. Other payment and top-up methods are to be determined. Failed generations cost nothing."}</p>
      </div>
    </main>
  );
}

function Check() {
  return <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#f5f5f5] text-xs font-black text-[#171717]">✓</span>;
}

function Benefit({ title, copy }: { title: string; copy: string }) {
  return <div className="flex gap-3"><Check /><div><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{copy}</p></div></div>;
}
