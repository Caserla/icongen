import { PolicyPage, type PolicySection } from "@/components/legal/policy-page";

const sections: PolicySection[] = [
  {
    title: { en: "Local self-use", zh: "本地自用" },
    paragraphs: {
      en: ["EASY ICON is a locally deployed icon creation tool. This version has no credit purchases, subscriptions, or payment checkout. Your configured model provider may charge separately; review its terms before generating."],
      zh: ["EASY ICON 是本地部署的图标创作工具。当前版本不提供点数购买、订阅或支付结账。自行配置的模型服务可能另行收费，生成前请确认其使用条款和费用。"],
    },
  },
  {
    title: { en: "Responsible use", zh: "合理使用" },
    items: {
      en: ["Keep credentials private and use only providers and assets you are authorized to access.", "Do not generate unlawful, sexually explicit or NSFW content, exploitative material, or content infringing others' rights.", "Review generated icons before use; output may contain errors and is not guaranteed unique or suitable for production."],
      zh: ["妥善保护凭据，仅使用已获授权的模型服务和素材。", "不得生成违法、色情或 NSFW、剥削性或侵犯他人权利的内容。", "使用前请审核生成图标；结果可能存在错误，也不保证独创性或生产适用性。"],
    },
  },
  {
    title: { en: "Deployment responsibility", zh: "部署责任" },
    paragraphs: {
      en: ["The deployer manages access control, backups, provider configuration, and compliance. Review the repository license and dependency licenses before redistribution. These usage notes do not grant a software license."],
      zh: ["部署者负责访问控制、备份、模型配置和合规。再分发前请核实项目及依赖的许可证；本使用说明不构成软件授权。"],
    },
  },
];

export default function TermsPage() {
  return <PolicyPage eyebrow="EASY ICON" title={{ en: "Usage terms", zh: "使用说明" }} summary={{ en: "Local deployment and responsible icon creation.", zh: "本地部署及图标创作的使用边界。" }} version={{ en: "Local version", zh: "本地版本" }} lastUpdated={{ en: "Updated: October 14, 2026", zh: "更新：2026 年 10 月 14 日" }} sections={sections} />;
}
