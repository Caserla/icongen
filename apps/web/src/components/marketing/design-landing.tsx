"use client";

import { ICON_STYLE_PRESETS } from "@icongen/shared";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { myIconsEnabled } from "@/lib/product-features";
import styles from "./design-landing.module.css";
import { useLandingMotion } from "./use-landing-motion";

const ART_ROOT = "/images/landing-art/iconsax-rebuild-2026-09-13";
const SUBJECT_ROOT = "/images/landing-art/subject-spectrum-2026-09-14";

const COMPARISON_ASSETS = [
  `${ART_ROOT}/comparison-flat.png`,
  `${ART_ROOT}/comparison-pixel.png`,
  `${ART_ROOT}/comparison-isometric.png`,
] as const;

const SUBJECT_ASSETS = {
  planter: `${ART_ROOT}/composition-subject.png`,
  camera: `${SUBJECT_ROOT}/instant-camera.png`,
  controller: `${SUBJECT_ROOT}/gaming-controller.png`,
  terrarium: `${SUBJECT_ROOT}/nature-terrarium.png`,
  telescope: `${SUBJECT_ROOT}/observatory-telescope.png`,
  jellyfish: `${SUBJECT_ROOT}/luminous-jellyfish.png`,
  sneaker: `${SUBJECT_ROOT}/technical-sneaker.png`,
} as const;

type SubjectAssetName = keyof typeof SUBJECT_ASSETS;

const SUBJECT_SPECTRUM: SubjectAssetName[] = [
  "camera",
  "controller",
  "terrarium",
  "telescope",
  "jellyfish",
  "sneaker",
];

const illustrationPresets = ICON_STYLE_PRESETS.filter(
  (preset) => preset.id !== "line-icon",
);

const copy = {
  en: {
    skip: "Skip to the work",
    heroKicker: "EASY ICON / ICON GENERATION WORKSPACE",
    heroTitle: "One brief. A complete visual system.",
    heroBody:
      "Describe what the product needs, choose its visual language, and compare three original directions before refining one.",
    primary: "Start creating",
    secondary: "Browse icons",
    pause: "Pause motion",
    play: "Play motion",
    heroAlt:
      "A precision icon foundry displaying a beetle, sailboat, and seed pod",
    facts: [
      ["09", "visual styles"],
      ["03", "directions per brief"],
      ["03", "composition modes"],
      ["PNG", "master and ready sizes"],
    ],
    subjectKicker: "A WIDER SUBJECT RANGE",
    subjectTitle: "Products, tools, nature, and creatures all belong here.",
    subjectBody:
      "Each example keeps its own silhouette and material language, showing the range of subjects the same generation workflow can handle.",
    subjectLabels: [
      "Instant camera",
      "Game controller",
      "Miniature terrarium",
      "Observatory telescope",
      "Luminous jellyfish",
      "Technical sneaker",
    ],
    manifesto: [
      "Describe.",
      "Compose.",
      "Style.",
      "Compare.",
      "Refine.",
      "Download.",
    ],
    manifestoBody:
      "The generation flow keeps every meaningful decision visible before the request leaves the page.",
    capabilityKicker: "ONE WORKFLOW, SEVEN DECISIONS",
    capabilityTitle: "Everything that changes the result, in one place.",
    capabilityBody:
      "No hidden prompt ritual. Subject, composition, background, comparison, detail, scale, and export stay connected.",
    capabilityLabels: [
      ["Describe", "Write the subject in plain language."],
      ["Compose", "Centered, edge-anchored, or full-bleed."],
      ["Background", "Transparent, solid, or gradient."],
      ["Compare", "Three directions from one request."],
      ["Refine", "Adjust one result without restarting."],
      ["Scale", "Preview the sizes the interface needs."],
      ["Export", "Keep the 2K RGBA master and derive 128, 64, and 24 px files."],
    ],
    compositionModes: ["Centered", "Edge anchored", "Full bleed"],
    compositionReadout: ["LIVE FRAME", "PREVIEW"],
    directionLabels: ["Flat", "Pixel", "Isometric 3D"],
    exportLabels: ["ORIGINAL PNG", "MASTER · 2K · RGBA", "READY SIZES"],
    promptExample: [
      "SUBJECT INPUT EXAMPLE",
      "A smart planter with a glass canopy, visible roots, and a warm status light.",
      "USED TO GENERATE 3 VISUAL DIRECTIONS",
      "FILLED",
    ],
    styleKicker: "NINE VISUAL LANGUAGES",
    styleTitle: "Different subjects. Distinct drawing logic. One calm display.",
    styleBody:
      "Each preset gets a representative object and its own visual treatment. The cabinet keeps the presentation consistent without repeating one motif across the page.",
    styleAlt:
      "Nine different icon subjects shown in a single dark exhibition cabinet",
    compositionKicker: "COMPOSITION IS A DESIGN INPUT",
    compositionTitle: "A centered icon is only one answer.",
    compositionBody:
      "Set a standard center, let the subject anchor to an edge, or use a full-bleed scene. The generated frame should follow the choice—not correct it afterward.",
    compositionAlt:
      "The same observatory telescope moving through centered, edge-anchored, and full-bleed composition modes",
    processKicker: "SETTINGS THAT SHOW THEIR EFFECT",
    processTitle: "Four controls, four contained motions.",
    processBody:
      "Each preview demonstrates one decision at a time. Nothing competes with the control being explained.",
    processCards: [
      ["Subject brief", "The description is typed once and remains editable."],
      ["Composition", "The frame cycles through the three supported layouts."],
      ["Background", "Automatic color or manual control stays visible."],
      ["Output", "Original, 128, 64, and 24 px remain linked."],
    ],
    archiveKicker: "ONE SOURCE, EVERY USEFUL SIZE",
    archiveTitle: "Keep the detail. Export only what the interface needs.",
    archiveBody:
      "The high-resolution result remains the source of truth while smaller versions are derived for practical use.",
    archiveAlt:
      "A game controller kept as one high-resolution PNG master with 128, 64, and 24 pixel derivatives",
    railTitle: "Designed for the work around the icon",
    railItems: [
      "APP ICONS",
      "BRAND ILLUSTRATION",
      "INTERACTION DESIGN",
      "STYLE EXPLORATION",
      "DETAIL ADJUSTMENT",
      "PNG EXPORT",
      "TRANSPARENT BACKGROUND",
      "FULL-BLEED SCENES",
    ],
    faqKicker: "DETAILS",
    faqTitle: "Before the first generation.",
    faqs: [
      [
        "What does one request return?",
        "One subject brief returns three visual directions so you can compare the idea before committing to a refinement.",
      ],
      [
        "Which illustration styles are available?",
        "Flat illustration, cute sticker, pixel art, neon, minimal logo, playful flat, low poly, isometric 3D, and clay 3D.",
      ],
      [
        "Can the background remain transparent?",
        "Yes. Illustration generation supports transparent, solid, and gradient backgrounds, with shape and color controls shown only when relevant.",
      ],
      [
        "What can I download?",
        "The detail page provides the original PNG plus 128, 64, and 24 pixel derivatives prepared from that source.",
      ],
    ],
    closeKicker: "THE NEXT SUBJECT IS YOURS",
    closeTitle: "Bring the brief. Leave with options worth comparing.",
    closeBody:
      "Start with the object, tool, animal, product, or scene your interface needs next.",
    pricing: "View pricing",
  },
  zh: {
    skip: "跳到作品区",
    heroKicker: "EASY ICON / 图标生成工作台",
    heroTitle: "一份描述，形成一套完整视觉方向。",
    heroBody:
      "写下产品真正需要的主体，选择视觉语言，先比较三个原创方向，再继续细化其中一版。",
    primary: "开始创作",
    secondary: "浏览图标",
    pause: "暂停动效",
    play: "播放动效",
    heroAlt: "精密图标工坊陈列机械甲虫、折纸帆船和种荚图标",
    facts: [
      ["09", "种视觉风格"],
      ["03", "每份描述三个方向"],
      ["03", "种构图模式"],
      ["PNG", "原图与常用尺寸"],
    ],
    subjectKicker: "更丰富的主体范围",
    subjectTitle: "产品、工具、自然与生物，都可以成为图标。",
    subjectBody:
      "每件示例保留自己的轮廓与材质语言，展示同一套生成流程可以处理的不同主体，而不是反复使用同一个母题。",
    subjectLabels: [
      "即时相机",
      "游戏手柄",
      "微型生态缸",
      "天文观测仪",
      "发光水母",
      "运动鞋",
    ],
    manifesto: ["描述。", "构图。", "选风格。", "比较。", "细化。", "下载。"],
    manifestoBody:
      "生成请求发出之前，真正影响结果的每个决定都保持可见。",
    capabilityKicker: "一个流程，七个决定",
    capabilityTitle: "影响结果的设置，都在同一个工作区。",
    capabilityBody:
      "不需要猜隐藏提示词。主体、构图、背景、方案比较、细节、尺寸与导出始终保持关联。",
    capabilityLabels: [
      ["描述主体", "用自然语言写清产品需要什么。"],
      ["选择构图", "标准居中、贴边构图或场景满版。"],
      ["设置背景", "透明、单色或渐变。"],
      ["比较方案", "一份请求返回三个方向。"],
      ["细化结果", "不必重来，直接调整选中方案。"],
      ["检查尺寸", "预览界面真正需要的大小。"],
      ["导出文件", "保留 2K RGBA 主文件，并派生 128、64 与 24 px 文件。"],
    ],
    compositionModes: ["标准居中", "贴边构图", "场景满版"],
    compositionReadout: ["实时构图", "生成前预览"],
    directionLabels: ["扁平", "像素", "等距 3D"],
    exportLabels: ["原始 PNG", "主文件 · 2K · RGBA", "常用尺寸"],
    promptExample: [
      "主体输入示例",
      "一台带玻璃罩、可见根系和暖色状态灯的智能桌面种植器。",
      "将用于生成 3 个视觉方向",
      "已填写",
    ],
    styleKicker: "九种视觉语言",
    styleTitle: "不同主体、明确风格，放进同一套安静的陈列系统。",
    styleBody:
      "每种预设使用有代表性的对象和准确的绘制语言；展柜统一页面的视觉秩序，不再让同一个素材反复占据整页。",
    styleAlt: "九种不同图标主体陈列在统一的黑色展柜中",
    compositionKicker: "构图本身就是生成参数",
    compositionTitle: "标准居中，只是其中一种答案。",
    compositionBody:
      "可以选择标准居中、让主体贴住画面边缘，或使用场景满版。生成画面应该直接遵循这个选择，而不是事后裁切。",
    compositionAlt: "同一天文观测仪依次展示标准居中、贴边和场景满版构图",
    processKicker: "能看见效果的设置",
    processTitle: "四个设置，四段互不干扰的动效。",
    processBody:
      "每个预览只说明一个决定，动画被限制在自己的卡片中，不再彼此抢夺注意力。",
    processCards: [
      ["主体描述", "内容只输入一次，并始终可以继续编辑。"],
      ["构图方式", "画框依次展示三种受支持的布局。"],
      ["背景颜色", "自动生成与手动设置都保持可见。"],
      ["输出尺寸", "原图、128、64 与 24 px 始终关联。"],
    ],
    archiveKicker: "一份源文件，覆盖常用尺寸",
    archiveTitle: "保留细节，只导出界面真正需要的大小。",
    archiveBody:
      "高清结果始终作为源文件，较小版本从同一主文件派生，避免多次处理造成质量漂移。",
    archiveAlt: "游戏手柄保留为高清 PNG 主文件，并派生 128、64 和 24 像素版本",
    railTitle: "围绕图标工作的完整链路",
    railItems: [
      "APP 图标",
      "品牌插画",
      "交互设计",
      "风格探索",
      "细节调整",
      "PNG 导出",
      "透明背景",
      "场景满版",
    ],
    faqKicker: "具体信息",
    faqTitle: "开始第一次生成之前。",
    faqs: [
      [
        "一次请求会返回什么？",
        "一份主体描述返回三个视觉方向，先比较想法，再决定细化哪一版。",
      ],
      [
        "插画设计有哪些风格？",
        "扁平插画、可爱贴纸、像素艺术、霓虹、极简标志、扁平活泼、低多边形、等距 3D 和黏土 3D。",
      ],
      [
        "背景可以保持透明吗？",
        "可以。插画生成支持透明、单色和渐变背景；只有对应模式需要时，才会展示形状和颜色设置。",
      ],
      [
        "可以下载哪些文件？",
        "详情页提供原始 PNG，以及由同一源文件派生的 128、64 和 24 像素版本。",
      ],
    ],
    closeKicker: "下一个主体，由你决定",
    closeTitle: "带来一份描述，得到值得比较的方向。",
    closeBody: "从界面下一步需要的物品、工具、动物、产品或场景开始。",
    pricing: "查看价格",
  },
};

function MediaPanel({
  src,
  alt,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`${styles.mediaPanel} ${className ?? ""}`.trim()}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 760px) 94vw, 1000px"
      />
    </div>
  );
}

function SubjectAsset({
  name,
  sizes = "160px",
  alt = "",
}: {
  name: SubjectAssetName;
  sizes?: string;
  alt?: string;
}) {
  return (
    <Image
      src={SUBJECT_ASSETS[name]}
      alt={alt}
      fill
      sizes={sizes}
    />
  );
}

function SubjectSpectrum({
  kicker,
  title,
  body,
  labels,
}: {
  kicker: string;
  title: string;
  body: string;
  labels: string[];
}) {
  return (
    <section
      className={styles.subjectSpectrum}
      data-motion-group
      aria-labelledby="subject-spectrum-title"
    >
      <div className={styles.subjectSpectrumHeading} data-reveal>
        <div>
          <p className={styles.eyebrow}>{kicker}</p>
          <h2 id="subject-spectrum-title">{title}</h2>
        </div>
        <p>{body}</p>
      </div>
      <div className={styles.subjectSpectrumGrid}>
        {SUBJECT_SPECTRUM.map((name, index) => (
          <article
            className={styles.subjectSpectrumCard}
            data-asset={name}
            data-reveal
            key={name}
          >
            <div className={styles.subjectSpectrumArtwork}>
              <SubjectAsset name={name} alt={labels[index]} sizes="180px" />
            </div>
            <footer>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{labels[index]}</b>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function CompositionShowcase({
  modes,
  readout,
  alt,
  asset,
}: {
  modes: string[];
  readout: string[];
  alt: string;
  asset: SubjectAssetName;
}) {
  return (
    <div className={styles.compositionShowcase} role="img" aria-label={alt}>
      <div className={styles.compositionToolbar} aria-hidden="true">
        {modes.map((mode, index) => (
          <span key={mode} style={{ "--mode-index": index } as CSSProperties}>
            <i />{mode}
          </span>
        ))}
      </div>
      <div className={styles.compositionStage} aria-hidden="true">
        <div className={styles.compositionSafeArea} />
        <div className={styles.compositionStageSubject}>
          <SubjectAsset name={asset} sizes="(max-width: 860px) 76vw, 560px" />
        </div>
        <div className={styles.compositionScaleReadout}>
          <span>{readout[0]}</span><b>{readout[1]}</b>
        </div>
      </div>
    </div>
  );
}

function ExportShowcase({
  labels,
  alt,
  asset,
}: {
  labels: string[];
  alt: string;
  asset: SubjectAssetName;
}) {
  return (
    <div className={styles.exportShowcase} role="img" aria-label={alt}>
      <div className={styles.exportMaster}>
        <div className={styles.exportMasterMeta}>
          <span>{labels[0]}</span>
          <b>{labels[1]}</b>
        </div>
        <div className={styles.exportMasterPreview} aria-hidden="true">
          <SubjectAsset name={asset} sizes="(max-width: 860px) 54vw, 420px" />
        </div>
      </div>
      <div className={styles.exportReady} aria-hidden="true">
        <span>{labels[2]}</span>
        <div>
          {["128", "64", "24"].map((size, index) => (
            <article
              className={styles.exportSizeCard}
              key={size}
              style={{ "--size-index": index } as CSSProperties}
            >
              <i><SubjectAsset name={asset} sizes="96px" /></i>
              <b>{size} px</b>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function CapabilityGrid({
  labels,
  compositionModes,
  directionLabels,
  exportLabels,
  promptExample,
}: {
  labels: string[][];
  compositionModes: string[];
  directionLabels: string[];
  exportLabels: string[];
  promptExample: string[];
}) {
  return (
    <div className={styles.capabilityGrid}>
      {labels.map(([title, body], index) => (
        <article
          className={`${styles.capabilityCard} ${styles[`capability${index + 1}`]}`}
          data-tilt
          key={title}
        >
          <header>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </header>
          {index === 0 && (
            <figure className={styles.promptSpecimen}>
              <figcaption>
                <span>{promptExample[0]}</span>
                <strong>{promptExample[3]}</strong>
              </figcaption>
              <p>{promptExample[1]}</p>
              <footer>
                <span>{promptExample[2]}</span>
                <b>{promptExample[1].length} / 400</b>
              </footer>
            </figure>
          )}
          {index === 1 && (
            <div className={styles.compositionSpecimen} aria-hidden="true">
              {compositionModes.map((mode) => (
                <span key={mode}>
                  <i><SubjectAsset name="telescope" sizes="120px" /></i>
                  <b>{mode}</b>
                </span>
              ))}
            </div>
          )}
          {index === 2 && (
            <div className={styles.backgroundSpecimen} aria-hidden="true">
              {["transparent", "solid", "gradient"].map((background) => (
                <span data-background={background} key={background}>
                  <i><SubjectAsset name="jellyfish" sizes="90px" /></i>
                </span>
              ))}
            </div>
          )}
          {index === 3 && (
            <div className={styles.resultSpecimen} aria-hidden="true">
              {directionLabels.map((label, directionIndex) => (
                <span key={label}>
                  <i>
                    <Image
                      src={COMPARISON_ASSETS[directionIndex]}
                      alt=""
                      fill
                      sizes="200px"
                    />
                  </i>
                  <b>{label}</b>
                </span>
              ))}
            </div>
          )}
          {index === 4 && (
            <div className={styles.refineSpecimen} aria-hidden="true">
              <span><SubjectAsset name="camera" sizes="150px" /></span>
              <span><SubjectAsset name="camera" sizes="150px" /></span>
              <i />
            </div>
          )}
          {index === 5 && (
            <div className={styles.scaleSpecimen} aria-hidden="true">
              {["24", "64", "128"].map((size) => (
                <span key={size}>
                  <i><SubjectAsset name="sneaker" sizes="120px" /></i>
                  <b>{size}</b>
                </span>
              ))}
            </div>
          )}
          {index === 6 && (
            <div className={styles.exportSpecimen} aria-hidden="true">
              <div className={styles.exportSpecimenMaster}>
                <i><SubjectAsset name="camera" sizes="96px" /></i>
                <span><b>{exportLabels[0]}</b><small>{exportLabels[1]}</small></span>
              </div>
              <div className={styles.exportSpecimenSizes}>
                {["128", "64", "24"].map((size) => <span key={size}>{size}</span>)}
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ProcessGrid({
  cards,
  promptExample,
}: {
  cards: string[][];
  promptExample: string[];
}) {
  return (
    <div className={styles.processGrid} data-motion-group data-motion-sequence>
      {cards.map(([title, body], index) => (
        <article className={styles.processCard} data-motion-step key={title}>
          <div className={styles.processDemo} aria-hidden="true">
            {index === 0 && (
              <div className={styles.typeDemo}>
                <span>{promptExample[0]}</span>
                <p>{promptExample[1]}</p>
                <i />
              </div>
            )}
            {index === 1 && (
              <div className={styles.modeDemo}>
                <span><i><SubjectAsset name="terrarium" sizes="180px" /></i></span>
                <span><i><SubjectAsset name="terrarium" sizes="180px" /></i></span>
                <span><i><SubjectAsset name="terrarium" sizes="180px" /></i></span>
              </div>
            )}
            {index === 2 && (
              <div className={styles.colorDemo}>
                <div><span>AUTO</span><i /></div>
                <div><span>MANUAL</span><i /></div>
                <b />
              </div>
            )}
            {index === 3 && (
              <div className={styles.outputDemo}>
                {["ORIGINAL", "128", "64", "24"].map((size) => (
                  <span key={size}>
                    <i><SubjectAsset name="controller" sizes="120px" /></i>
                    <b>{size}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={styles.processCopy}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DesignLanding() {
  const { locale } = useLocale();
  const c = copy[locale];
  const rootRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  useLandingMotion(rootRef);

  const styleLabels = illustrationPresets.map((preset) => preset.label[locale]);

  return (
    <main
      className={`${styles.home} butter-home`}
      id="main-content"
      ref={rootRef}
      data-paused={paused}
    >
      <a className={styles.skip} href="#work">{c.skip}</a>
      <div className={styles.dotField} aria-hidden="true" />

      <section className={styles.heroTrack} data-motion-group data-scroll-progress aria-labelledby="landing-title">
        <div className={styles.heroSticky}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{c.heroKicker}</p>
            <h1 id="landing-title">{c.heroTitle}</h1>
            <p className={styles.heroBody}>{c.heroBody}</p>
            <div className={styles.actions}>
              <Link href="/create" className={styles.primaryAction}>
                <span>{c.primary}</span><i aria-hidden="true" />
              </Link>
              {myIconsEnabled ? (
                <Link href="/icons" className={styles.secondaryAction}>{c.secondary}</Link>
              ) : null}
            </div>
          </div>
          <div className={styles.heroMedia} id="work">
            <MediaPanel
              src={`${ART_ROOT}/icon-foundry.png`}
              alt={c.heroAlt}
              priority
              className={styles.heroArtwork}
            />
            <button
              type="button"
              className={styles.motionToggle}
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
            >
              <span aria-hidden="true" />
              {paused ? c.play : c.pause}
            </button>
          </div>
        </div>
      </section>

      <dl className={styles.factStrip} data-reveal>
        {c.facts.map(([value, label]) => (
          <div key={label}><dt>{value}</dt><dd>{label}</dd></div>
        ))}
      </dl>

      <SubjectSpectrum
        kicker={c.subjectKicker}
        title={c.subjectTitle}
        body={c.subjectBody}
        labels={c.subjectLabels}
      />

      <section className={styles.manifestoTrack} data-scroll-progress aria-label={c.manifesto.join(" ")}>
        <div className={styles.manifestoSticky}>
          <h2>
            {c.manifesto.map((word, index) => (
              <span
                key={word}
                style={{ "--word-index": index } as CSSProperties}
              >{word}</span>
            ))}
          </h2>
          <p>{c.manifestoBody}</p>
          <div className={styles.giantWord} aria-hidden="true">EASY ICON</div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="capability-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.eyebrow}>{c.capabilityKicker}</p>
          <h2 id="capability-title">{c.capabilityTitle}</h2>
          <p>{c.capabilityBody}</p>
        </div>
        <CapabilityGrid
          labels={c.capabilityLabels}
          compositionModes={c.compositionModes}
          directionLabels={c.directionLabels}
          exportLabels={c.exportLabels}
          promptExample={c.promptExample}
        />
      </section>

      <section className={`${styles.section} ${styles.cabinetSection}`} data-motion-group data-scroll-progress aria-labelledby="style-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.eyebrow}>{c.styleKicker}</p>
          <h2 id="style-title">{c.styleTitle}</h2>
          <p>{c.styleBody}</p>
        </div>
        <div className={styles.cabinetFrame} data-tilt>
          <MediaPanel src={`${ART_ROOT}/style-cabinet.png`} alt={c.styleAlt} />
        </div>
        <div className={styles.styleLabels} aria-label={styleLabels.join(", ")}>
          <div>
            {[...styleLabels, ...styleLabels].map((label, index) => (
              <span key={`${label}-${index}`}>{String((index % styleLabels.length) + 1).padStart(2, "0")} {label}</span>
            ))}
          </div>
        </div>
      </section>

      <section
        className={styles.compositionTrack}
        data-motion-group
        data-scroll-progress
        aria-labelledby="composition-title"
      >
        <div className={styles.compositionSticky}>
          <div className={styles.compositionCopy} data-reveal>
            <p className={styles.eyebrow}>{c.compositionKicker}</p>
            <h2 id="composition-title">{c.compositionTitle}</h2>
            <p>{c.compositionBody}</p>
          </div>
          <div className={styles.compositionMedia} data-reveal>
            <CompositionShowcase
              modes={c.compositionModes}
              readout={c.compositionReadout}
              alt={c.compositionAlt}
              asset="telescope"
            />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="process-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.eyebrow}>{c.processKicker}</p>
          <h2 id="process-title">{c.processTitle}</h2>
          <p>{c.processBody}</p>
        </div>
        <ProcessGrid cards={c.processCards} promptExample={c.promptExample} />
      </section>

      <section
        className={styles.archiveTrack}
        data-motion-group
        data-scroll-progress
        aria-labelledby="archive-title"
      >
        <div className={styles.archiveSticky}>
          <div className={styles.archiveCopy} data-reveal>
            <p className={styles.eyebrow}>{c.archiveKicker}</p>
            <h2 id="archive-title">{c.archiveTitle}</h2>
            <p>{c.archiveBody}</p>
          </div>
          <div className={styles.archiveMedia} data-reveal>
            <ExportShowcase labels={c.exportLabels} alt={c.archiveAlt} asset="controller" />
          </div>
        </div>
      </section>

      <section className={styles.railSection} data-motion-group aria-label={c.railTitle}>
        <h2 data-reveal>{c.railTitle}</h2>
        <div className={styles.textRail} aria-hidden="true">
          <div>
            {[...c.railItems, ...c.railItems].map((item, index) => (
              <span key={`${item}-${index}`}>{item}<i /></span>
            ))}
          </div>
        </div>
        <div className={`${styles.textRail} ${styles.textRailReverse}`} aria-hidden="true">
          <div>
            {[...c.railItems, ...c.railItems].reverse().map((item, index) => (
              <span key={`${item}-reverse-${index}`}>{item}<i /></span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div className={styles.faqHeading} data-reveal>
          <p className={styles.eyebrow}>{c.faqKicker}</p>
          <h2 id="faq-title">{c.faqTitle}</h2>
        </div>
        <div className={styles.faqList}>
          {c.faqs.map(([question, answer]) => (
            <details key={question} data-reveal>
              <summary><span>{question}</span><i aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.closingSection} aria-labelledby="closing-title">
        <div className={styles.closingCopy} data-reveal>
          <p className={styles.eyebrow}>{c.closeKicker}</p>
          <h2 id="closing-title">{c.closeTitle}</h2>
          <p>{c.closeBody}</p>
          <div className={styles.actions}>
            <Link href="/create" className={styles.primaryAction}>
              <span>{c.primary}</span><i aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
