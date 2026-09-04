# ADR-0004：月付 VPS 测试部署基线

- 状态：已确认
- 日期：2026-08-26
- 适用范围：短期、低并发、受邀用户测试

## 背景


图片 Worker 使用 Sharp 检查和派生至少 1024px PNG，下载接口还会在服务端聚合文件并生成 ZIP。1 GB 主机在构建、图片处理或下载时容易出现内存压力。项目现有数据库事务、RLS、认证和私有文件均建立在 Supabase 上，把 PostgreSQL 迁入 VPS 会扩大测试范围且没有明显成本收益。

## 决策

- 短期测试使用东京区域月付 VPS；账单应按小时累计并以月套餐价格封顶，具体供应商可替换。
- 基线规格为 2 vCPU、4 GB RAM、约 80 GB SSD，并配置 2–4 GB swap。
- 单台 VPS 合并运行 HTTPS 入口、Next.js Web/BFF、独立 Icon Worker、Sub2API、Sub2API 专用 PostgreSQL 和 Redis。
- Worker 与 Sub2API 使用同一私有容器网络，通过内部 `IMAGE_PROVIDER_BASE_URL` 和 Bamboo 专用 API Key 调用；Sub2API API 端口、PostgreSQL 和 Redis 不直接暴露公网。
- 继续使用现有 Supabase Auth、PostgreSQL 和私有 Storage。测试项目区域应尽量靠近 VPS 和主要测试用户，避免不必要的跨洲请求。
- Worker 必须作为独立常驻进程运行，不能依赖开发环境的 BFF 子进程启动器。
- 测试阶段全局 Worker 并发限制为 1；每个用户仍最多 1 个活动任务；默认将单批主体数运营限制为 1–3 个。
- 测试阶段优先使用模拟生成或受控测试点数；真实模型调用必须配置账户级预算和速率限制。
- 测试期不启用中国大陆 CDN 节点；如后续迁入中国大陆节点或使用境内 CDN，再单独处理 ICP 备案与相关合规事项。

## 不采用的方案

- **1 GB VPS 同时运行 Web、Worker 和 PostgreSQL**：图片处理、ZIP 和构建的内存余量不足，且会重复 Supabase 已提供的能力。
- **2 GB VPS 合并运行 Bamboo 与 Sub2API**：Next.js、Sharp Worker、Sub2API、PostgreSQL 和 Redis 的内存余量不足。
- **仅部署 Next.js，不部署生产 Worker**：当前生产模式不会启动本地 Worker，任务会停留在 `queued`。
- **测试阶段直接迁移数据库**：会同时影响 Supabase Auth、RLS、数据库函数和 Storage，不符合短期测试目标。

## 升级条件

出现以下任一情况时升级到至少 8 GB RAM，或优先把 Sub2API/Worker 拆到独立节点：

- 开放非受邀注册或出现多个并发生成用户；
- 单批常态超过 3 个主体；
- 发生内存不足、swap 持续使用、ZIP 下载失败或 Web 延迟明显上升；

正式公开上线前，重新评估 Vercel/独立 Worker 或其他托管执行平台，不把本 ADR 的单机测试拓扑直接视为生产高可用方案。

合并部署必须下调 Sub2API PostgreSQL 缓存、连接上限、Redis 连接池及图片并发，并持续监控 swap、OOM、Web 延迟和生成失败。该拓扑是成本优先的短期测试方案，不是生产高可用方案。

## 影响

- 固定基础设施预算约为一台 4 GB 月付 VPS（参考 Lightsail 同档约 USD 24/月）；域名、模型调用、Supabase、邮件、备份和监控费用另计。
- Web、Worker 和 Sub2API 可在一台主机快速联调，但共享单一故障域，必须通过容器编排、资源限制、健康检查、备份和日志保证基本可恢复性。
- 数据和生成资产仍位于境外 Supabase，邀请真实用户前必须提供隐私说明、删除入口并确认适用的数据出境要求。
