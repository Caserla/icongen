# 环境配置与测试索引

更新时间：2026-09-01

## Web 环境变量

以 `apps/web/.env.example` 为模板：

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`：仅服务端使用

## Worker 环境变量

以 `services/icon-worker/.env.example` 为模板：

- `IMAGE_PROVIDER=mock|openai`
- `IMAGE_MODEL`，当前默认 `gpt-image-2`
- `IMAGE_QUALITY=low|medium|high|auto`，当前默认 `high`
- `IMAGE_SIZE=1024x1024|2048x2048`，当前默认 `2048x2048`
- `IMAGE_PROVIDER_BASE_URL`
- `IMAGE_PROVIDER_API_KEY`
- `ICON_SKILL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ICON_BUCKET`
- `GENERATION_MAX_ATTEMPTS`

不要把真实密钥写入 Git、前端公开变量、文档示例或日志。

## 常用验证命令

```bash
npm test
npm run typecheck
npm run lint
```

按工作区验证：

```bash
npm run test --workspace=@icongen/web
npm run test --workspace=@icongen/shared
npm run test --workspace=@icongen/icon-skill
npm run test --workspace=@icongen/icon-worker
npm run typecheck --workspace=@icongen/backend-core
```

## 测试覆盖入口

- Web：表单主体与背景设置同步、筛选互斥、分页、设置接口、认证校验。
- Shared：当前设置目录、生成协议、默认交互参数、下载协议和旧任务兼容映射。
- Icon Skill：用途模板、9 种 style spec、参考图注册、背景与几何契约、方案差异。
- Worker：并发生成、失败终态、透明背景、假棋盘格、参考板复刻、几何告警、PNG 缩放、SVG 派生和 Provider 配置。

## 真实链路验收

真实 Image2 测试会产生费用，不属于普通单元测试。执行前确认使用测试账户与限额 Key，并记录任务 ID。至少检查：

1. `queued → processing → completed/partial/failed` 状态流转。
2. 每个主体 3 个方案及失败单方案重试。
3. source、preview、输出尺寸和可选 SVG 资产。
4. 透明 Alpha、无假棋盘格、背景形状与圆角。
5. ZIP 包含原图与所选尺寸，且仅含当前用户资产。
6. 结果页刷新、我的图标筛选与分页恢复。

## 常见故障方向

- 一直 queued：确认数据库函数已部署、本地 Worker 是否启动以及 Service Role 配置。
- Image2 失败：检查 Provider Base URL、API Key、模型名、额度、网关日志和请求兼容性。
- 页面没有结果：检查方案状态、`generation_assets`、Storage Bucket 和签名 URL。
- 假透明或白底：检查是否进入透明/色键处理分支以及源 PNG Alpha 通道。
- SVG 色差或毛边：只对受支持风格派生；转换失败应保留 PNG 并跳过 SVG。
