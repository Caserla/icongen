# 技术架构概览

## 推荐 MVP 架构

- Web：Next.js、React、TypeScript、Tailwind CSS。
- 部署：Vercel，面向海外用户提供 CDN 和 HTTPS。
- BFF：Next.js Route Handlers，承载用户 API 和 Stripe Webhook。
- 身份、数据库和对象存储：Supabase Auth、PostgreSQL、Storage。
- 支付：Stripe Checkout 和经过签名校验的 Webhook。
- 异步生成：AWS SQS、Lambda Worker 和 DLQ，首选 `us-east-1`。
- 图片模型：OpenAI GPT Image 2，通过 Provider Adapter 调用。
- 可观测性：Vercel Logs、CloudWatch、Sentry。

## 代码边界

- `apps/web`：用户界面、管理界面和 BFF。
- `services/icon-worker`：消费生成任务、调用模型、保存结果和更新状态。
- `packages/icon-skill`：提示词结构、负向约束、输出要求和 Skill 版本。
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
- 任务创建与扣点保持事务一致。
- Stripe Webhook 是支付入账唯一可信来源。
- 支付、扣点、返还和生成请求全部幂等。
- 用户资源默认私有，通过短时签名 URL 下载。
- 前端不直接持有模型、Stripe 或数据库管理密钥。
