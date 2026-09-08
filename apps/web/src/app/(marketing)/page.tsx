"use client";
import { ButtonLink } from "@/components/ui/button-link";
import { useLocale } from "@/components/i18n/locale-provider";
import { HomeIntro } from "@/components/marketing/home-intro";
import { IconDropShowcase } from "@/components/marketing/icon-drop-showcase";
import { IconEditorShowcase } from "@/components/marketing/icon-editor-showcase";
import { Reveal } from "@/components/motion/reveal";

const copy = {
  en: {
    eyebrow: "A creative system for product icons",
    title: "Build every icon your product needs—in one visual language.",
    body: "Describe the set once. Explore three directions for every icon, refine the details, and ship production-ready assets without losing consistency.",
    action: "Create an icon set",
    secondary: "See the workflow",
    ticker: [
      "Nine visual styles",
      "Three options each",
      "PNG + SVG",
      "Set-level consistency",
    ],
    sectionTitle: "From a rough list to a complete icon system.",
    steps: [
      ["Describe", "Add the icons your product needs in plain language."],
      ["Direct", "Choose style, structure, scale, stroke, and background."],
      ["Refine", "Compare, revise, and export the options that feel right."],
    ],
  },
  zh: {
    eyebrow: "为产品而生的图标创作系统",
    title: "一次定义视觉语言，生成产品需要的整套图标。",
    body: "描述图标清单，为每个图标探索 3 个方向；调整细节并导出可直接使用的生产资产，同时保持整套风格一致。",
    action: "开始创建图标集",
    secondary: "查看工作流程",
    ticker: ["九种视觉风格", "每个图标三种方案", "PNG + SVG", "整套风格一致"],
    sectionTitle: "从一份简单清单，到完整的图标系统。",
    steps: [
      ["描述", "用自然语言添加产品需要的每个图标。"],
      ["定向", "选择风格、结构、大小、线宽与背景。"],
      ["完善", "比较、修改并导出真正满意的方案。"],
    ],
  },
};

export default function HomePage() {
  const { locale } = useLocale();
  const c = copy[locale];
  return (
    <main className="butter-home">
      <HomeIntro locale={locale} />
      <section className="butter-hero">
        <div className="butter-hero__grid" aria-hidden="true" />
        <div className="butter-hero__content">
          <p className="butter-kicker">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className="butter-hero__body">{c.body}</p>
          <div className="butter-hero__actions">
            <ButtonLink href="/create" className="butter-primary-cta">
              {c.action}
            </ButtonLink>
            <a href="#workflow" className="butter-text-link">
              {c.secondary}
            </a>
          </div>
        </div>
        <div
          className="butter-stage"
          aria-label={
            locale === "zh"
              ? "图标方案动态预览"
              : "Animated icon option preview"
          }
        >
          <div className="butter-stage__card butter-stage__card--one">
            <span>01</span>
            <strong>✦</strong>
            <small>SPARK</small>
          </div>
          <div className="butter-stage__card butter-stage__card--two">
            <span>02</span>
            <strong>⌁</strong>
            <small>FLOW</small>
          </div>
          <div className="butter-stage__card butter-stage__card--three">
            <span>03</span>
            <strong>●</strong>
            <small>FOCUS</small>
          </div>
          <div className="butter-stage__cursor" aria-hidden="true">
            ↖
          </div>
        </div>
      </section>

      <div className="butter-ticker" aria-label={c.ticker.join(", ")}>
        <div>
          {[...c.ticker, ...c.ticker].map((item, index) => (
            <span key={`${item}-${index}`}>
              {item}
              <i>✦</i>
            </span>
          ))}
        </div>
      </div>

      <IconDropShowcase locale={locale} />

      <Reveal>
        <IconEditorShowcase locale={locale} />
      </Reveal>

      <Reveal>
        <section id="workflow" className="butter-workflow">
          <p className="butter-kicker">01 / WORKFLOW</p>
          <h2>{c.sectionTitle}</h2>
          <div className="butter-workflow__grid">
            {c.steps.map(([title, description], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <i aria-hidden="true">{["＋", "◎", "↗"][index]}</i>
              </article>
            ))}
          </div>
        </section>
      </Reveal>
    </main>
  );
}
