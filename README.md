# EASY ICON

面向海外用户的批量 UI 功能图标生成网站。用户描述多个图标主体并选择设计方向，每个主体生成 3 个统一风格的 PNG 方案，并使用 Stripe 购买点数继续生成。

## 当前阶段

项目处于 MVP 前后端并行开发阶段，当前优先级：

1. 保持本地真实图片生成闭环稳定，并完成生产环境的服务端配置。
2. 完成支付、作品下载和账户删除闭环。
3. 按开发计划持续同步接口、测试和文档状态。

## MVP 已确认范围

- 英文界面优先。
- 每批支持 1–20 个图标主体。
- 每个主体固定生成 3 个方案；1 个主体消耗 1 点。
- Stripe 点数包付费。
- 下载格式首版为 PNG。
- 支持有/无背景、纯色/渐变及固定常用 PNG 尺寸；支持单图和选中结果 ZIP 下载。

## 仓库结构

```text
apps/web/                 Next.js 前端与 BFF
services/icon-worker/     异步图片生成 Worker
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

生产构建默认使用 Webpack，以避开受限环境中 Turbopack PostCSS 子进程绑定端口失败的问题。保留 `npm run build:turbo --workspace=@icongen/web` 用于诊断。构建前需设置有效的 `APP_ENV` 与 `NEXT_PUBLIC_APP_ENV`；本地验证可使用 `APP_ENV=development NEXT_PUBLIC_APP_ENV=development npm run build`，线上应使用实际部署环境配置。

当前已建立营销页、认证与账户页面、用户工作区、受角色保护的运营后台、BFF 路由、Supabase 数据层和图片生成核心。本地环境已支持由 BFF 启动 Worker 的真实图片生成、进度回显、结果下载链路；生产环境仍需配置服务端密钥与执行器。
