# 技术架构概览

## 推荐 MVP 架构

- Web：Next.js、React、TypeScript、Tailwind CSS。
- 短期测试部署：东京区域月付4 GB VPS，合并运行HTTPS入口、Next.js Web/BFF、独立Worker、Sub2API及其专用PostgreSQL/Redis；业务数据库继续使用Supabase。
- 正式生产候选：Vercel 承载 Web，生产 Worker 独立部署；在公开上线前根据测试结果重新评估，不直接把单机测试拓扑视为高可用生产方案。
- BFF：Next.js Route Handlers，承载用户 API 和 Stripe Webhook。
- 身份、数据库和对象存储：Supabase Auth、PostgreSQL、Storage。
- 支付：Stripe Checkout 和经过签名校验的 Webhook。
- 后台生成：本地开发由 Next.js BFF 直接启动 Worker；月付 VPS 测试环境使用独立常驻 Worker，全局并发限制为 1。
- 图片模型：OpenAI GPT Image 2，通过 Provider Adapter 调用。
- 模型网关：Worker通过私有容器网络调用同机Sub2API OpenAI-compatible接口；Sub2API使用自己的PostgreSQL和Redis，不与Supabase业务数据混用。
- 可观测性：测试环境至少监控主机资源、Web/Worker 日志和模型费用；正式生产使用 Vercel Logs、Supabase Logs、Sentry 或等效服务。

## 代码边界

- `apps/web`：用户界面、管理界面和 BFF。
- `services/icon-worker`：消费生成任务、调用模型、保存结果和更新状态。
- `packages/icon-skill`：用途模板、共享生产边界、每种 App 图标风格的详细 style spec、A/B/C 方案差异、输出要求和 Skill 版本。
- 版本化图标设计风格：共享目录提供 10 个稳定预设；App 插画图标页面展示除线性图标外的 9 种风格，交互图标使用独立结构/颜色/背景设置。
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

详细后端边界和数据事务见 [后端技术架构](./backend.md)；短期环境的资源、进程、安全和验收要求见 [月付 VPS 测试部署指南](../guides/monthly-vps-test-deployment.md)。
