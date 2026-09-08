import type { Metadata } from "next";
import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ICON GEN by EASY DESIGN collects, uses, stores, and protects personal information.",
};

const sections: PolicySection[] = [
  {
    title: { en: "About this policy", zh: "关于本政策" },
    paragraphs: {
      en: [
        "This Privacy Policy applies to ICON GEN, an online icon creation service operated under the EASY DESIGN brand. It covers our website, account features, creation tools, and related support. For privacy questions or requests, contact 04102198q@gmail.com.",
      ],
      zh: [
        "本隐私政策适用于 EASY DESIGN 品牌运营的在线图标创作服务 ICON GEN，包括网站、账户功能、创作工具及相关支持。如有隐私问题或需要行使权利，请联系 04102198q@gmail.com。",
      ],
    },
  },
  {
    title: { en: "Information we collect", zh: "我们收集的信息" },
    items: {
      en: [
        "Account and identity data, including your email address, display name, avatar, sign-in provider, verification status, role, and account timestamps.",
        "If you use Google Sign-In, we receive the basic profile information you authorize, such as your Google account identifier, name, email address, profile image, and email-verification status. We do not receive your Google password.",
        "Creation data, including subjects, prompts and editing instructions, style and output settings, generation jobs, selected variants, and generated assets.",
        "Credits and transaction data, including balances, ledger entries, redemption records, order and payment status, currency, refunds, and payment-provider identifiers. We do not store full payment-card details.",
        "Technical and security data, such as IP address, browser and device information, session identifiers, request metadata, service logs, error records, and abuse-prevention signals.",
        "Communications you send to us, including support requests and feedback.",
      ],
      zh: [
        "账户与身份信息，包括邮箱地址、显示名称、头像、登录服务商、验证状态、账户角色和账户时间记录。",
        "如果你使用 Google 登录，我们会接收你授权的基础资料，例如 Google 账户标识、姓名、邮箱地址、头像和邮箱验证状态；我们不会获得你的 Google 密码。",
        "创作信息，包括主体描述、提示词与编辑指令、风格和输出设置、生成任务、所选方案及生成资产。",
        "点数与交易信息，包括余额、账本、兑换记录、订单与支付状态、币种、退款和支付服务商标识；我们不保存完整的银行卡信息。",
        "技术与安全信息，例如 IP 地址、浏览器和设备信息、会话标识、请求元数据、服务日志、错误记录和防滥用信号。",
        "你发送给我们的通信内容，包括客服请求和反馈。",
      ],
    },
  },
  {
    title: { en: "How we use information", zh: "我们如何使用信息" },
    items: {
      en: [
        "Create and secure your account, authenticate sign-ins, and remember essential preferences.",
        "Process generation and editing requests, store and display results, and enable previews and downloads.",
        "Operate credits, redemptions, orders, payments, refunds, retries, and dispute handling.",
        "Maintain reliability and security, prevent abuse and fraud, diagnose incidents, and improve performance.",
        "Provide support, send service-related notices, enforce our Terms, and comply with legal obligations.",
      ],
      zh: [
        "创建并保护账户、验证登录，并保存必要的偏好设置。",
        "处理生成与编辑请求，存储和展示结果，并提供预览与下载。",
        "处理点数、兑换、订单、支付、退款、重试和争议。",
        "维护服务稳定与安全、防止滥用和欺诈、排查事故并改善性能。",
        "提供支持、发送服务通知、执行服务条款并履行法律义务。",
      ],
    },
  },
  {
    title: { en: "Legal bases and your choices", zh: "处理依据与你的选择" },
    paragraphs: {
      en: [
        "Where applicable law requires a legal basis, we process information to perform our contract with you, comply with legal obligations, pursue legitimate interests such as security and service improvement, or act with your consent. Google Sign-In is optional where another sign-in method is available, and you may revoke its access through your Google Account settings.",
      ],
      zh: [
        "在适用法律要求处理依据时，我们会基于履行与你的合同、遵守法律义务、实现安全与服务改进等合法利益，或取得你的同意来处理信息。在提供其他登录方式时，Google 登录属于可选功能；你可以在 Google 账户设置中撤销其访问权限。",
      ],
    },
  },
  {
    title: { en: "Service providers and international transfers", zh: "服务商与跨境处理" },
    paragraphs: {
      en: [
        "We use service providers to operate ICON GEN, including Supabase for authentication, databases, and private object storage; AWS infrastructure in Singapore; configured image-generation providers; Google for optional sign-in; and payment providers when you make a purchase. They process information only as needed to provide their services and under their own terms and safeguards.",
        "Information may be processed outside your country or region. Where required, we use contractual, organizational, or other lawful safeguards for international transfers. We do not use Google user data for advertising and request only the scopes needed for sign-in.",
      ],
      zh: [
        "我们使用第三方服务运行 ICON GEN，包括用于认证、数据库和私有对象存储的 Supabase，位于新加坡的 AWS 基础设施，已配置的图像生成服务商，用于可选登录的 Google，以及你购买服务时使用的支付服务商。它们仅在提供相应服务所需范围内，依据各自条款和保障措施处理信息。",
        "信息可能在你所在国家或地区之外处理。适用法律要求时，我们会采用合同、组织或其他合法保障措施。我们不会将 Google 用户数据用于广告，并且只申请登录所需的权限范围。",
      ],
    },
  },
  {
    title: { en: "Storage and retention", zh: "存储与保留" },
    paragraphs: {
      en: [
        "Generated files are stored in private object storage and are normally accessed through time-limited signed URLs. We retain account, generation, asset, transaction, security, and support records only for as long as reasonably necessary to provide the service, protect users, resolve disputes, and meet legal obligations.",
        "Retention periods vary by data type and operational or legal need. When information is no longer required, we delete or de-identify it, except where continued retention is necessary for legal claims, fraud prevention, accounting, or other lawful purposes.",
      ],
      zh: [
        "生成文件存放在私有对象存储中，通常通过有时效的签名 URL 访问。账户、生成、资产、交易、安全和支持记录仅在提供服务、保护用户、解决争议及履行法律义务所合理需要的期间保留。",
        "具体期限会因信息类型及运营或法律需要而不同。信息不再需要时，我们会删除或去标识化；为处理法律主张、防止欺诈、履行会计义务或其他合法目的而必须继续保留的除外。",
      ],
    },
  },
  {
    title: { en: "Cookies and local storage", zh: "Cookie 与本地存储" },
    paragraphs: {
      en: [
        "We use cookies, session technologies, and local storage required for sign-in, security, and preferences such as language. We do not currently use cross-context behavioural advertising. If we introduce non-essential analytics or advertising, we will update this policy and provide any consent controls required by law.",
      ],
      zh: [
        "我们使用登录、会话安全以及语言等偏好所必需的 Cookie、会话技术和本地存储。目前不使用跨场景行为广告。如未来加入非必要分析或广告，我们会更新本政策并提供法律要求的同意控制。",
      ],
    },
  },
  {
    title: { en: "Security", zh: "信息安全" },
    paragraphs: {
      en: [
        "We use access controls, private storage, signed asset links, encryption in transit, logging, and operational safeguards designed to protect information. No online service can guarantee absolute security. Do not submit passwords, financial-account numbers, government identifiers, health information, or other sensitive personal data in prompts.",
      ],
      zh: [
        "我们采用访问控制、私有存储、签名资产链接、传输加密、日志和运营保障措施保护信息。任何在线服务都无法保证绝对安全。请勿在提示词中提交密码、金融账户号码、政府证件号、健康信息或其他敏感个人信息。",
      ],
    },
  },
  {
    title: { en: "Your privacy rights", zh: "你的隐私权利" },
    paragraphs: {
      en: [
        "Depending on where you live, you may have rights to know, access, correct, delete, restrict or object to processing, receive a portable copy, withdraw consent, or complain to a data-protection authority. We do not sell personal information or share it for cross-context behavioural advertising.",
        "Send requests to 04102198q@gmail.com. We may verify your identity before acting and may retain information where permitted or required by law. Revoking Google access stops future access from that account but does not automatically delete information already processed by ICON GEN; you may separately request deletion.",
      ],
      zh: [
        "根据你的所在地，你可能享有知情、访问、更正、删除、限制或反对处理、获取可携带副本、撤回同意，或向数据保护机构投诉的权利。我们不出售个人信息，也不为跨场景行为广告共享个人信息。",
        "请将请求发送至 04102198q@gmail.com。处理前我们可能验证你的身份，并可在法律允许或要求的范围内保留必要信息。撤销 Google 授权会阻止未来访问，但不会自动删除 ICON GEN 已处理的信息；你可以另行提出删除请求。",
      ],
    },
  },
  {
    title: { en: "Children", zh: "未成年人" },
    paragraphs: {
      en: ["ICON GEN is not directed to children under 16. If you believe a child has provided personal information without valid permission, contact us so we can review and take appropriate action."],
      zh: ["ICON GEN 并非面向 16 岁以下未成年人。如果你认为未成年人在未获有效许可的情况下提交了个人信息，请联系我们，以便核查并采取适当措施。"],
    },
  },
  {
    title: { en: "Changes and contact", zh: "政策变更与联系" },
    paragraphs: {
      en: ["We may update this policy as the service or law changes. We will update the date above and provide additional notice when a change materially affects your rights. Questions and privacy requests can be sent to 04102198q@gmail.com."],
      zh: ["我们可能因服务或法律变化更新本政策。若变更会对你的权利产生重大影响，我们会更新上方日期并提供适当的额外通知。问题及隐私请求可发送至 04102198q@gmail.com。"],
    },
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="EASY DESIGN / ICON GEN"
      title={{ en: "Privacy Policy", zh: "隐私政策" }}
      summary={{
        en: "This policy explains what personal information ICON GEN handles, why we use it, where it may be processed, and the choices available to you.",
        zh: "本政策说明 ICON GEN 会处理哪些个人信息、使用目的、可能的处理地点，以及你可以作出的选择。",
      }}
      version={{ en: "Version: effective", zh: "版本：正式生效" }}
      lastUpdated={{
        en: "Effective and last updated: September 8, 2026",
        zh: "生效及最后更新：2026 年 9 月 8 日",
      }}
      sections={sections}
    />
  );
}
