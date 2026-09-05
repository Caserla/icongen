# 环境分层与测试索引

更新时间：2026-09-05

## 四环境定义

`APP_ENV` 是部署环境，`NODE_ENV` 只控制框架编译模式，两者不能混用。测试、预发布和生产构建都可以运行在 `NODE_ENV=production`，但业务隔离以 `APP_ENV` 为准。

| 环境 | `APP_ENV` / `NEXT_PUBLIC_APP_ENV` | 数据与第三方资源 | 域名与用途 | 搜索收录 |
| --- | --- | --- | --- | --- |
| 开发 | `development` | 本地 Supabase、Mock Provider | `localhost`，日常开发 | 禁止 |
| 测试 | `test` | 独立测试库、Mock/受控故障注入 | 自动化与 CI | 禁止 |
| 预发布 | `preproduction` | 独立预发布 Supabase、预发布 Provider Key | 当前 `https://esdesign.men`，真实链路验收 | 禁止 |
| 生产 | `production` | 独立生产 Supabase、生产 Provider Key | 正式对外服务 | 允许 |

必须同时设置：

- `APP_ENV`：Web 服务端和 Worker 使用。
- `NEXT_PUBLIC_APP_ENV`：前端构建时固化，必须与 `APP_ENV` 相同。
- `SUPABASE_ENVIRONMENT`：声明当前密钥所属环境，必须与 `APP_ENV` 相同。
- `NEXT_PUBLIC_APP_URL`：预发布和生产必须为非本机 HTTPS URL。
- `PUBLIC_SIGNUP_ENABLED`：预发布和生产默认关闭；只有明确设为 `true` 才开放注册。

运行时会拒绝环境标识不一致、预发布/生产使用 HTTP 或 localhost，以及生产使用 Mock 图片 Provider。故障注入只允许 `test` 和 `preproduction`，不再错误依赖 `NODE_ENV`。非生产环境会同时输出 `robots.txt` 禁止规则和 `X-Robots-Tag: noindex, nofollow, noarchive`。

## 配置模板

- `.env.development.example`
- `.env.test.example`
- `.env.preproduction.example`
- `.env.production.example`
- Web 局部模板：`apps/web/.env.example`
- Worker 局部模板：`services/icon-worker/.env.example`

从对应模板复制成本机或服务器私有文件，例如 `.env.preproduction`。真实密钥不得写入 Git、公开前端变量、文档或日志。

## 当前 1 GB 新加坡预发布部署

使用 `compose.preproduction.yml` 完整运行 Web、单并发 Worker 与 Caddy，并为 1 GB 主机设置保守的容器内存上限。Worker 固定 `GENERATION_CONCURRENCY=1`，优先保证链路完整而不是吞吐量：

```bash
cp .env.preproduction.example .env.preproduction
# 在服务器本地填写真实预发布值
docker compose --env-file .env.preproduction -f compose.preproduction.yml config
docker compose --env-file .env.preproduction -f compose.preproduction.yml up -d --build
curl -fsS https://esdesign.men/api/health
curl -I https://esdesign.men | grep -i x-robots-tag
```

预期健康检查返回 `environment: preproduction`，且 `docker compose ps` 中 Web、Worker、Caddy 均为运行状态。临时占用 80/443 的 Caddy 容器需要在正式 Compose 切换前停止并移除，但应保留 `/data` 证书数据卷。

1 GB 仅作为低流量预发布验收配置：Web 400 MB、Worker 384 MB、Caddy 64 MB，并依赖已配置的 2 GB Swap。出现 Swap 持续增长、Worker OOM、页面明显变慢时应停止生成压测并扩容。扩容后只需提高 Compose 资源限制和 `GENERATION_CONCURRENCY`，业务代码和数据库结构无需迁移。

## 人机分工

代码侧由研发完成：环境契约、启动校验、非生产 noindex、Compose、测试、文档和部署脚本。云端必须由项目所有者完成：创建相互独立的 Supabase 项目和 Provider Key、在服务器私有环境文件中录入密钥、配置 Cloudflare DNS/访问策略、Supabase Site URL/Redirect URL、SMTP/DNS 验证和最终生产发布批准。

## 常用验证命令

```bash
npm test
npm run typecheck
npm run lint
docker compose --env-file .env.preproduction -f compose.preproduction.yml config
```

## 真实链路验收

真实 Image2 测试会产生费用。执行前确认使用预发布账户与限额 Key，并记录任务 ID。至少检查：

1. `queued → processing → completed/partial/failed` 状态流转。
2. 每个主体 3 个方案及失败单方案重试。
3. source、preview、输出尺寸和可选 SVG 资产。
4. 透明 Alpha、无假棋盘格、背景形状与圆角。
5. ZIP 仅包含当前用户资产。
6. 结果页刷新、我的图标筛选与分页恢复。
7. `/api/health` 环境标识正确，预发布响应包含 noindex。

## 常见故障方向

- 启动时报环境不匹配：核对 `APP_ENV`、`NEXT_PUBLIC_APP_ENV`、`SUPABASE_ENVIRONMENT`。
- 一直 queued：确认独立 Worker 是否启动、数据库函数及 Service Role 配置。
- Image2 失败：检查预发布 Provider Base URL、Key、模型、额度和网关日志。
- 页面没有结果：检查方案状态、`generation_assets`、Storage Bucket 和签名 URL。
- 假透明或白底：检查透明/色键处理分支与源 PNG Alpha 通道。
