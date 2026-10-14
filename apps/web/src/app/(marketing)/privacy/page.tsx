import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";

const sections: PolicySection[] = [
  {
    title: { en: "Local data", zh: "本地数据" },
    paragraphs: {
      en: ["Account profiles, projects, generated SVGs, favorites, recycle-bin records, and preferences are stored by your configured authentication, database, and storage services. Local deployment does not automatically upload these records to a hosted EASY ICON service."],
      zh: ["账户资料、项目、生成 SVG、收藏、回收记录及偏好保存在你配置的认证、数据库和存储服务中。本地部署不会自动将这些记录上传至 EASY ICON 托管服务。"],
    },
  },
  {
    title: { en: "External model requests", zh: "外部模型请求" },
    paragraphs: {
      en: ["Generation and visual review send relevant prompts, project context, reference images, and generated output to the configured model endpoint. Local hosting is not fully offline. Avoid entering confidential information and check your provider's retention policy."],
      zh: ["生成和视觉审核会向所配置的模型接口发送相关提示词、项目上下文、参考图和生成结果。本地部署不等于完全离线；请勿输入机密信息，并核实模型服务的数据保留政策。"],
    },
  },
  {
    title: { en: "Sessions and maintenance", zh: "会话及维护" },
    paragraphs: {
      en: ["Cookies and local storage support sign-in and interface preferences. Server logs may contain request metadata and errors. The deployer controls retention, backups, access, and deletion. This version does not collect payments or create new credit purchases; historical tables from earlier versions are retained unless explicitly migrated or removed."],
      zh: ["Cookie 和本地存储用于登录及界面偏好；服务日志可能包含请求元信息和错误。部署者负责保留期限、备份、访问与删除。当前版本不收款或创建点数购买；旧版本的历史表会保留，除非明确迁移或删除。"],
    },
  },
];

export default function PrivacyPage() {
  return <PolicyPage eyebrow="EASY ICON" title={{ en: "Privacy notes", zh: "隐私说明" }} summary={{ en: "Where local data and model requests go.", zh: "本地数据与模型请求的去向。" }} version={{ en: "Local version", zh: "本地版本" }} lastUpdated={{ en: "Updated: October 14, 2026", zh: "更新：2026 年 10 月 14 日" }} sections={sections} />;
}
