# 基本安全闭环测试用例

更新时间：2026-09-03

## SEC-BASIC-001 默认测试收集

执行 `npm test`，必须包含 Web 嵌套目录中的细节调整、筛选、分页和安全测试，不允许只运行 `src/lib` 浅层用例。

## SEC-BASIC-002 安全响应头

请求 `/`、`/create` 和任一 API，验证 CSP、HSTS、`nosniff`、`frame-ancestors`、Referrer Policy、Permissions Policy 和 COOP；生产响应不得包含 `X-Powered-By`。

## SEC-BASIC-003 同源写请求

1. 同源 JSON POST 正常进入业务路由。
2. 外部 Origin、缺少 Origin 或 `Sec-Fetch-Site: cross-site` 返回 403。
3. 非 JSON 请求体返回 415。
4. 声明超过 1 MiB 的请求体返回 413。
5. Stripe Webhook 暂不受浏览器 Origin 规则影响，后续必须依赖签名验真。

## SEC-BASIC-004 应用层限流

分别覆盖注册、登录、找回/重置密码、重发邮件、CD-Key、创建生成、失败重试和细节调整：

1. 窗口内请求未超限时通过。
2. 超限返回 429、稳定错误码和 `Retry-After`。
3. 不同账户互不占用额度；未登录入口按 IP 隔离。
4. 窗口到期后恢复。
5. CD-Key 连续错误尝试触发更严格限制。

## SEC-BASIC-005 下载资源边界

1. 最多选择 20 个方案。
2. 第 21 个方案在 Schema 层拒绝。
3. 单文件超过 16 MiB 返回 413。
4. ZIP 输入累计超过 64 MiB 返回 413，不继续分配归档内存。
5. 所有权、完成状态、SVG 可用性校验保持不变。

## SEC-BASIC-006 日志脱敏

构造包含 `Authorization`、Cookie、API Key、Token、签名 URL、Prompt、调整指令和 Bearer 文本的错误上下文；日志只能出现 `[REDACTED]`，长错误必须截断。

## SEC-BASIC-007 Worker 与部署

1. Web `/api/health` 返回 200。
2. Worker 健康状态能区分正常、队列阻塞和配置缺失。
3. Web/Worker 容器以非 root 用户运行。
4. 容器异常退出后自动拉起；SIGTERM 能在超时内优雅退出。
5. Caddy 仅代理 Web，Worker、数据库、Redis和模型网关不暴露公网端口。

## SEC-BASIC-008 完整回归

依次执行：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

随后通过真实 HTTP 检查安全响应头、跨站写请求、超限请求、429、健康检查和正常页面访问。任何一项失败均不能标记基本闭环完成。

## 2026-09-03 本地验收结果

- `npm test`：132 项通过，Web 嵌套目录测试已由默认命令完整收集。
- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run build`：Next.js 生产构建通过。
- 同源安全：伪造外部 Origin 的写请求返回 `403 INVALID_REQUEST_ORIGIN`。
- 限流：使用隔离测试 IP 连续提交 11 次登录请求，前 10 次进入业务校验，第 11 次返回 `429 RATE_LIMITED`。
- 响应头：本地真实 HTTP 响应包含 CSP、HSTS、Frame、Referrer 和 Permissions Policy，且已关闭 `X-Powered-By`。
- Compose：`docker compose config` 通过；Web 与 Worker 镜像构建成功。
- 容器身份：两个业务镜像均以 `icongen` 非 root 用户运行。

尚未执行云服务器上的 HTTPS、进程重启、安全组和 Worker 真实队列验收，因此当前结论是“代码与本地部署基本闭环通过”，不是“公网生产级闭环通过”。
