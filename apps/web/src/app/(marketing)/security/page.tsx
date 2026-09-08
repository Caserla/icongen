import type { Metadata } from "next";
import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";

export const metadata: Metadata = {
  title: "Security Policy",
  description: "Security practices for EASY ICON.",
};

const sections: PolicySection[] = [
  {
    title: { en: "Our approach", zh: "我们的安全原则" },
    paragraphs: {
      en: [
        "EASY ICON designs EASY ICON around least privilege, data minimisation, isolated services, and recoverable operations. This page describes current pre-release controls; it does not claim a certification, independent audit, or guarantee that incidents can never occur.",
      ],
      zh: [
        "EASY ICON 以最小权限、数据最小化、服务隔离和可恢复操作为原则建设 EASY ICON。本页面描述当前预发布环境的实际控制措施，不代表已取得安全认证或独立审计，也不承诺安全事件绝不会发生。",
      ],
    },
  },
  {
    title: { en: "Account and access security", zh: "账户与访问安全" },
    items: {
      en: [
        "Authentication is handled through Supabase Auth; passwords are not stored in EASY ICON application tables.",
        "Protected pages and APIs verify the signed-in user on the server. Administrative routes require a separate administrator role and sensitive actions are audited.",
        "Database ownership checks and row-level access rules restrict users to their own jobs, assets, revisions, and credit records.",
        "Production administrator multi-factor authentication and operating procedures remain required before public launch.",
      ],
      zh: [
        "认证由 Supabase Auth 处理；密码不会存储在 EASY ICON 应用业务表中。",
        "受保护页面和 API 会在服务端验证登录用户；管理路由另行校验管理员角色，并记录敏感操作审计。",
        "数据库所有权检查与行级访问规则将用户限制在其自己的任务、资产、修订版本和点数记录范围内。",
        "正式上线前仍须为生产管理员启用多因素认证，并确认运营操作制度。",
      ],
    },
  },
  {
    title: { en: "Application and asset protection", zh: "应用与资产保护" },
    items: {
      en: [
        "Browser traffic is served over HTTPS. Server secrets are kept outside client bundles and must not be committed to source control.",
        "Generated images are stored in private buckets. Preview and download access uses scoped, time-limited signed URLs and server-side ownership validation.",
        "Generation requests use schema validation, account-level concurrency controls, idempotency, retry limits, and transactional credit-ledger operations.",
        "Sensitive prompt history was removed from persistent migrated fields; operational logs are expected to avoid secrets and unnecessary prompt content.",
      ],
      zh: [
        "浏览器流量通过 HTTPS 提供；服务端密钥不进入客户端代码包，也不得提交到源码仓库。",
        "生成图片存放于私有存储桶；预览和下载使用有范围、有时效的签名 URL，并在服务端验证资源所有权。",
        "生成请求采用结构校验、账户级并发控制、幂等处理、重试上限和事务化点数账本。",
        "持久化迁移字段中的敏感提示词历史已移除；运营日志应避免记录密钥及非必要的提示词内容。",
      ],
    },
  },
  {
    title: { en: "Infrastructure and operations", zh: "基础设施与运维" },
    items: {
      en: [
        "The pre-release stack runs behind Caddy on an AWS Lightsail instance in Singapore with host and cloud firewalls, Fail2ban, and container isolation.",
        "Worker, Sub2API, PostgreSQL, and Redis communicate over private container networking; database and cache ports are not intentionally exposed to the public internet.",
        "Health and readiness checks, worker heartbeats, audit records, and bounded retries support detection and recovery.",
        "Automated encrypted backups, restore drills, centralised alerts, image-based deployment, and one-command rollback remain pre-production requirements rather than completed controls.",
      ],
      zh: [
        "预发布服务运行在新加坡 AWS Lightsail 实例上，由 Caddy 提供入口，并配置云防火墙、主机防火墙、Fail2ban 与容器隔离。",
        "Worker、Sub2API、PostgreSQL 与 Redis 通过私有容器网络通信；数据库和缓存端口不会被有意暴露到公网。",
        "健康与就绪检查、Worker 心跳、审计记录及受限重试用于支持故障发现和恢复。",
        "自动加密备份、恢复演练、集中告警、镜像化发布和一键回滚仍是生产前要求，当前不作为已完成能力对外承诺。",
      ],
    },
  },
  {
    title: { en: "Your security responsibilities", zh: "你的安全责任" },
    items: {
      en: [
        "Use a unique password, protect your email account, and sign out on shared devices.",
        "Do not submit passwords, API keys, access tokens, financial details, government identifiers, health information, or other sensitive personal data in icon prompts.",
        "Do not attempt to bypass access controls, probe other users’ data, disrupt the service, or upload unlawful or malicious content.",
      ],
      zh: [
        "使用独立密码，保护好邮箱账户，并在共用设备上及时退出。",
        "不要在图标提示词中提交密码、API Key、访问令牌、财务信息、政府证件号、健康信息或其他敏感个人信息。",
        "不要绕过访问控制、探测其他用户数据、干扰服务，或提交违法及恶意内容。",
      ],
    },
  },
  {
    title: { en: "Vulnerability reporting", zh: "漏洞报告" },
    paragraphs: {
      en: [
        "If you believe you found a security issue, do not access data beyond what is necessary to demonstrate it, do not disrupt the service, and do not publicly disclose the issue before we can investigate. A dedicated security contact and coordinated-disclosure process must be published before production launch. No bug-bounty payment is offered unless explicitly agreed in writing.",
      ],
      zh: [
        "如果你认为发现了安全问题，请勿访问证明问题所需范围以外的数据、勿干扰服务，并在我们完成调查前避免公开披露。正式上线前必须公布专用安全联系渠道和协调披露流程。除非另有书面约定，我们不承诺提供漏洞奖金。",
      ],
    },
  },
  {
    title: { en: "Incident response", zh: "安全事件响应" },
    paragraphs: {
      en: [
        "We investigate suspected incidents, contain affected systems, preserve relevant evidence, restore service, and notify affected users or authorities when applicable law requires it. Notification timing depends on the facts and legal requirements; this draft does not promise a fixed response SLA.",
      ],
      zh: [
        "我们会调查疑似安全事件、控制受影响系统、保留相关证据并恢复服务；适用法律要求时，将通知受影响用户或主管机构。通知时间取决于事件事实与法律要求，本草案不承诺固定响应时限。",
      ],
    },
  },
  {
    title: { en: "Changes and scope", zh: "变更与适用范围" },
    paragraphs: {
      en: [
        "We will revise this page as controls and providers change. The final operator identity, security contact, incident escalation owners, backup evidence, monitoring coverage, and independent review are release requirements tracked by the project—not completed claims.",
      ],
      zh: [
        "随着控制措施和服务商变化，我们会更新本页面。最终运营主体、安全邮箱、事件升级负责人、备份证据、监控覆盖及独立审阅均作为项目发布要求跟踪，不视为已经完成的安全声明。",
      ],
    },
  },
];

export default function SecurityPage() {
  return (
    <PolicyPage
      eyebrow="EASY ICON"
      title={{ en: "Security Policy", zh: "安全政策" }}
      summary={{
        en: "This page explains the controls currently used to protect EASY ICON accounts, generated assets, infrastructure, and operations.",
        zh: "本页面说明 EASY ICON 当前用于保护账户、生成资产、基础设施与运营流程的安全措施。",
      }}
      sections={sections}
    />
  );
}
