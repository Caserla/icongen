import type { Metadata } from "next";
import { PolicyPage } from "@/components/legal/policy-page";

export const metadata: Metadata = { title: "Acceptable Use Policy", description: "Content and safety rules for EASY ICON SVG generation." };

export default function AcceptableUsePage() {
  return <PolicyPage eyebrow="EASY ICON" title={{ en: "Acceptable Use Policy", zh: "可接受使用政策" }} summary={{ en: "EASY ICON is an independent AI-assisted SVG icon tool for apps and product interfaces, powered by third-party models. NSFW and harmful content generation is prohibited.", zh: "EASY ICON 是基于第三方模型的独立 AI 辅助 SVG 图标工具，用于应用和产品界面。禁止生成 NSFW 及有害内容。" }} version={{ en: "Version: effective", zh: "版本：正式生效" }} lastUpdated={{ en: "Last updated: September 30, 2026", zh: "最后更新：2026 年 9 月 30 日" }} sections={[
    { title: { en: "Prohibited sexual content", zh: "禁止性内容" }, paragraphs: { en: ["Do not request, generate, upload, store, or distribute NSFW, pornographic, sexually explicit or sexually suggestive images, sexual nudity, sexual exploitation, or any sexual content involving minors. These restrictions apply to prompts, SVGs, and exported images, including stylized, symbolic, or abstract depictions."], zh: ["不得请求、生成、上传、存储或传播 NSFW、色情、露骨或性暗示图像、性裸露、性剥削，以及任何涉及未成年人的性内容。规则适用于提示词、SVG 和导出图片，包括风格化、符号化或抽象表现。"] } },
    { title: { en: "Other harmful or unlawful use", zh: "其他有害或违法使用" }, paragraphs: { en: ["Do not create content facilitating abuse, exploitation, violence, harassment, fraud, or infringement of others’ rights. Do not use the service for non-consensual intimate depictions, impersonation, face manipulation, or deceptive deepfakes."], zh: ["不得创作协助虐待、剥削、暴力、骚扰、欺诈或侵犯他人权利的内容。不得用于非自愿私密描绘、冒充他人、人脸操纵或欺骗性深度伪造。"] } },
    { title: { en: "Enforcement and reporting", zh: "执行与举报" }, paragraphs: { en: ["Do not attempt to evade these rules through coded prompts or other bypasses. We may reject requests, remove prohibited content, or restrict or suspend accounts that violate this policy. Report prohibited content or safety concerns to support@esdesign.men, including the relevant project or item identifier where available. This policy is part of our Terms of Service."], zh: ["不得通过编码提示词或其他方式尝试绕过规则。我们可拒绝请求、移除违规内容、限制或暂停违反本政策的账户。请通过 support@esdesign.men 举报违规内容或安全问题，并在可行时提供相关项目或图标标识。本政策属于服务条款的一部分。"] } },
  ]} />;
}
