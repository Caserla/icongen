import type { Metadata } from "next";
import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing access to and use of EASY ICON.",
};

const sections: PolicySection[] = [
  {
    title: { en: "Agreement and operator", zh: "协议与运营方" },
    paragraphs: {
      en: ["These Terms govern your access to EASY ICON, an online icon creation service operated under the EASY ICON brand. By creating an account, purchasing credits, or using the service, you agree to these Terms and our Privacy Policy. If you do not agree, do not use EASY ICON."],
      zh: ["本条款适用于由 EASY ICON 品牌运营的在线图标创作服务 EASY ICON。创建账户、购买点数或使用服务，即表示你同意本条款及《隐私政策》；如不同意，请勿使用 EASY ICON。"],
    },
  },
  {
    title: { en: "The service", zh: "服务内容" },
    paragraphs: {
      en: ["EASY ICON provides tools for generating, editing, previewing, storing, and downloading icons and illustrations. Features, models, limits, supported formats, and availability may change as the product develops. We may use third-party infrastructure and generation providers to deliver the service."],
      zh: ["EASY ICON 提供图标和插画的生成、编辑、预览、存储及下载工具。随着产品发展，功能、模型、使用限制、支持格式和可用性可能发生变化。我们可能使用第三方基础设施和生成服务商提供服务。"],
    },
  },
  {
    title: { en: "Accounts", zh: "账户" },
    items: {
      en: ["Provide accurate information and keep your sign-in credentials secure.", "You are responsible for activity under your account unless caused by our breach.", "Do not share, sell, transfer, or automate access to an account in a way that bypasses service limits.", "Notify us promptly if you suspect unauthorized access."],
      zh: ["请提供准确信息并妥善保护登录凭据。", "除因我们违约造成的情况外，你应对账户下的活动负责。", "不得以绕过服务限制的方式共享、出售、转让账户或自动化访问。", "如怀疑账户被未授权访问，请及时通知我们。"],
    },
  },
  {
    title: { en: "Credits, pricing, and payment", zh: "点数、价格与支付" },
    paragraphs: {
      en: ["Some actions consume credits. Current prices, included credits, and consumption rules are shown before purchase or use. Credits are contractual rights to access eligible EASY ICON services; they are not money, stored value, cryptocurrency, or an investment, do not earn interest, and cannot be redeemed for cash except where law requires.", "A purchase is credited only after confirmed payment or valid redemption. A browser success page alone is not proof of payment. Taxes, currency conversion, and payment-provider charges may apply as disclosed at checkout."],
      zh: ["部分操作会消耗点数。当前价格、包含点数和消耗规则会在购买或使用前展示。点数仅代表使用符合条件的 EASY ICON 服务的合同权利，不属于货币、储值、加密资产或投资，不产生利息，除法律另有强制规定外不可兑换现金。", "购买仅在支付确认或有效兑换后入账；浏览器显示成功页面本身不构成支付凭证。结账时披露的税费、货币转换费和支付服务商费用可能适用。"],
    },
  },
  {
    title: { en: "Refunds and billing issues", zh: "退款与账单问题" },
    paragraphs: {
      en: ["Consumed credits and completed generation services are generally non-refundable to the extent permitted by law. Contact us about duplicate charges, unauthorized payments, missing credits, or material service failures. Approved refunds may remove corresponding unused credits. Chargebacks or payment reversals may result in credits being withdrawn or the account being restricted while the issue is investigated. Mandatory consumer rights remain unaffected."],
      zh: ["在法律允许范围内，已消耗点数及已完成的生成服务通常不予退款。如遇重复扣款、未授权支付、点数未到账或重大服务故障，请联系我们。退款获批后，相应未使用点数可能被收回。拒付或支付撤销期间，我们可撤回相关点数或限制账户以便调查。法律赋予消费者的强制性权利不受影响。"],
    },
  },
  {
    title: { en: "Your content and generated output", zh: "你的内容与生成结果" },
    paragraphs: {
      en: ["You retain the rights you hold in content you submit. You grant us and our service providers a limited, worldwide license to host, copy, transmit, transform, and process that content only as needed to operate, secure, and improve the service and provide support.", "As between you and EASY ICON, we do not claim ownership of generated output to the extent ownership can exist under applicable law. Subject to these Terms and third-party rights, you may use output for personal or commercial purposes. You are responsible for reviewing it before use. AI output may be similar to other output and is not guaranteed to be unique, registrable, accurate, or free of third-party rights."],
      zh: ["你保留对所提交内容享有的权利。你授予我们及服务商有限的全球许可，仅为运营、保障和改进服务及提供支持之需，对这些内容进行托管、复制、传输、转换和处理。", "在你与 EASY ICON 之间，在适用法律允许生成结果享有权利的范围内，我们不主张其所有权。在遵守本条款及第三方权利的前提下，你可以将生成结果用于个人或商业用途，但应在使用前自行审核。AI 结果可能与他人结果相似，我们不保证其独特、可注册、准确或不涉及第三方权利。"],
    },
  },
  {
    title: { en: "Acceptable use", zh: "可接受使用规则" },
    items: {
      en: ["Do not create or distribute unlawful, fraudulent, deceptive, abusive, exploitative, or rights-infringing content.", "Do not upload malware, credentials, highly sensitive personal data, or content you have no right to use.", "Do not impersonate others, facilitate violence or exploitation, or use the service to harass or harm people.", "Do not probe security, bypass limits or payment controls, scrape at scale, reverse engineer protected systems, interfere with operations, or resell unauthorized access."],
      zh: ["不得创作或传播违法、欺诈、误导、虐待、剥削或侵犯他人权利的内容。", "不得上传恶意程序、账户凭据、高度敏感个人信息或无权使用的内容。", "不得冒充他人、协助暴力或剥削，也不得利用服务骚扰或伤害他人。", "不得探测安全机制、绕过限制或支付控制、大规模抓取、逆向受保护系统、干扰运营或转售未经授权的访问。"],
    },
  },
  {
    title: { en: "Our intellectual property", zh: "我们的知识产权" },
    paragraphs: {
      en: ["EASY ICON, its software, interface, brand, documentation, and non-user content are owned by us or our licensors and are protected by applicable law. These Terms grant only a limited, revocable right to use the service. If you provide feedback, you permit us to use it without restriction or compensation, while we will not publicly identify you without permission."],
      zh: ["EASY ICON 的软件、界面、品牌、文档及非用户内容归我们或许可方所有，并受适用法律保护。本条款仅授予有限且可撤销的服务使用权。如你提供反馈，即允许我们不受限制且无需付费地使用；未经许可，我们不会公开识别你的身份。"],
    },
  },
  {
    title: { en: "Suspension and termination", zh: "暂停与终止" },
    paragraphs: {
      en: ["You may stop using the service at any time. We may restrict or terminate access when reasonably necessary for security, legal compliance, non-payment, material or repeated breach, or protection of users and the service. Where practical and lawful, we will provide notice and an opportunity to resolve the issue. Provisions that by nature should survive termination will remain effective."],
      zh: ["你可以随时停止使用服务。为保障安全、遵守法律、处理未付款、应对重大或反复违约，或保护用户和服务，我们可在合理必要时限制或终止访问。在可行且合法的情况下，我们会提供通知和解决问题的机会。依其性质应在终止后继续有效的条款仍然有效。"],
    },
  },
  {
    title: { en: "Disclaimers", zh: "免责声明" },
    paragraphs: {
      en: ["To the maximum extent permitted by law, the service is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted availability, that every request will succeed, or that output will meet a particular purpose. You are responsible for backups, professional review, and checking licenses, rights, accuracy, and suitability before relying on output. Nothing here excludes warranties that cannot legally be excluded."],
      zh: ["在法律允许的最大范围内，服务按“现状”和“可用”基础提供。我们不保证服务不中断、每次请求均成功或结果适合特定目的。你应自行备份，并在依赖结果前进行专业审查，核查许可、权利、准确性和适用性。本条款不排除法律禁止排除的保证。"],
    },
  },
  {
    title: { en: "Limitation of liability", zh: "责任限制" },
    paragraphs: {
      en: ["To the maximum extent permitted by law, neither party is liable for indirect, incidental, special, consequential, or punitive loss, or for lost profits, revenue, data, or goodwill. Our aggregate liability relating to the service will not exceed the amount you paid to EASY ICON in the six months before the event giving rise to the claim. These limits do not apply to liability that cannot legally be limited, including where applicable fraud, wilful misconduct, or death or personal injury caused by negligence."],
      zh: ["在法律允许的最大范围内，任何一方均不对间接、附带、特殊、后果性或惩罚性损失，以及利润、收入、数据或商誉损失负责。我们与服务有关的累计责任不超过引发主张事件发生前六个月内你向 EASY ICON 支付的金额。上述限制不适用于法律禁止限制的责任，包括适用情况下的欺诈、故意不当行为，或因过失导致的死亡或人身伤害。"],
    },
  },
  {
    title: { en: "Changes, disputes, and contact", zh: "变更、争议与联系" },
    paragraphs: {
      en: ["We may update these Terms as the service or law changes. Material changes will be announced appropriately and apply prospectively from the stated effective date. Before starting formal proceedings, please contact us so we can try to resolve the issue in good faith. Nothing in these Terms removes mandatory consumer protections or your right to bring a claim in a court that applicable law requires to remain available. Questions may be sent to 04102198q@gmail.com."],
      zh: ["我们可能因服务或法律变化更新本条款。重大变更会以适当方式通知，并自标明的生效日期起向后适用。启动正式程序前，请先联系我们，以便善意协商解决。本条款不排除强制性消费者保护，也不剥夺你依法必须享有的向有管辖权法院提出主张的权利。问题可发送至 04102198q@gmail.com。"],
    },
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="EASY ICON"
      title={{ en: "Terms of Service", zh: "服务条款" }}
      summary={{ en: "These Terms explain the rules for using EASY ICON, purchasing and spending credits, and working with generated output.", zh: "本条款说明使用 EASY ICON、购买与消耗点数，以及使用生成结果时适用的规则。" }}
      version={{ en: "Version: effective", zh: "版本：正式生效" }}
      lastUpdated={{ en: "Effective and last updated: September 8, 2026", zh: "生效及最后更新：2026 年 9 月 8 日" }}
      sections={sections}
    />
  );
}
