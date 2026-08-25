# 技术架构概览

## 推荐 MVP 架构

- Web：Next.js、React、TypeScript、Tailwind CSS。
- 部署：Vercel，面向海外用户提供 CDN 和 HTTPS。
- BFF：Next.js Route Handlers，承载用户 API 和 Stripe Webhook。
- 身份、数据库和对象存储：Supabase Auth、PostgreSQL、Storage。
- 支付：Stripe Checkout 和经过签名校验的 Webhook。
- 后台生成：执行方式待结合现有 Supabase 架构确定，不预设额外云服务。
- 图片模型：OpenAI GPT Image 2，通过 Provider Adapter 调用。
- 可观测性：Vercel Logs、Supabase Logs、Sentry。

## 代码边界

- `apps/web`：用户界面、管理界面和 BFF。
- `services/icon-worker`：消费生成任务、调用模型、保存结果和更新状态。
- `packages/icon-skill`：用途模板、共享生产边界、每种 App 图标风格的详细 style spec、A/B/C 方案差异、输出要求和 Skill 版本。
- 版本化图标设计风格：共享目录提供 10 个稳定预设；App 图标页面展示除线性图标外的 9 种风格，交互图标使用独立结构/颜色/背景设置。
- `packages/shared`：共享类型、Zod Schema、状态枚举和业务常量。

## 前端工程结构

- 使用 npm Workspaces 管理 Monorepo；MVP 阶段暂不引入 Turborepo。
- `src/app/(marketing)`：首页和价格页。
- `src/app/(auth)`：登录和账户建立流程。
- `src/app/(dashboard)`：生成、历史、结果与账户页面。
- `src/app/(admin)`：独立后台路由边界。
- `src/app/api`：Next.js BFF、Stripe Webhook 和健康检查。
- `src/features`：按业务能力组织的组件、数据访问和状态。
- `src/components`：跨业务共享的布局和基础 UI。
- `packages/shared`：前后端共用的 Zod Schema、类型和状态枚举。

## 核心原则

- 图片生成必须异步执行。
- 生成任务按“多个主体 × 每主体 3 个 variant”建模，进度来自工作单元状态。
- 任务创建与扣点保持事务一致。
- Stripe Webhook 是支付入账唯一可信来源。
- 支付、扣点、返还和生成请求全部幂等。
- 用户资源默认私有，通过短时签名 URL 下载。
- 批量下载由服务端校验选中 variant 后生成临时 ZIP。
- 用户作品在生成完成 30 天后由清理任务删除；账户删除进入 30 天只读宽限期。
- 个人数据导出异步打包用户资料、订单、点数账本、账单摘要和仍有效的作品资产，ZIP 保存 24 小时并使用短时签名 URL。
- 前端不直接持有模型、Stripe 或数据库管理密钥。

详细后端边界、数据事务和部署流程见 [后端技术架构](./backend.md)。
