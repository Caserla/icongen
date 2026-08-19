# AI Icon Generator

面向海外用户的小型 App Icon 生成网站。用户通过英文描述产品功能和视觉风格，一次生成 4 个 Icon 方案，并使用 Stripe 购买点数继续生成。

## 当前阶段

项目处于 MVP 需求细化与前端基础建设阶段，当前优先级：

1. 建立本地项目和项目知识库。
2. 确定前端网站设计风格。
3. 细分并规划 6 个业务模块。

## MVP 已确认范围

- 英文界面优先。
- 单个 Icon 生成任务。
- 每次生成 4 个方案。
- Stripe 点数包付费。
- 下载格式首版为 PNG。
- 透明背景和输出规格在图片生成模块专项中确认。

## 仓库结构

```text
apps/web/                 Next.js 前端与 BFF
services/icon-worker/     异步图片生成 Worker（待初始化）
packages/icon-skill/      Icon 提示词 Skill 与版本管理
packages/shared/          共享类型、校验和常量
assets/                   项目视觉与静态资源
docs/                     项目知识库
```

知识库入口：[docs/index.md](docs/index.md)。

## 本地运行

```bash
npm install
npm run dev
```

质量检查：

```bash
npm run lint
npm run typecheck
npm run build
```

当前已建立营销页、登录页、用户工作区、运营后台及 BFF 路由骨架；Supabase、Stripe、AWS SQS 和图片模型仍待后续业务模块接入。
