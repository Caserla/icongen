# 生产安全代码底座回归测试

更新时间：2026-09-03

## 本轮范围

- 默认测试命令必须收集 Web 所有层级的 `*.test.ts`，包括细节调整、筛选、分页和安全测试。
- 全站返回 CSP、HSTS、`nosniff`、点击劫持、Referrer Policy、Permissions Policy 和 COOP 响应头。
- API 写请求拒绝跨站或缺少 Origin 的调用；有请求体时只接受 JSON，并限制为 1 MiB。
- 下载请求最多包含一个最大图标集的 20 个方案；单资源不得超过 16 MiB，归档输入总量不得超过 64 MiB。
- Worker 日志不得输出密钥字段、Bearer 凭据、签名 URL Token、完整 Prompt 或用户调整指令。

## 自动化结果

执行命令：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

结果：129 项测试通过；TypeScript、ESLint 和 Next.js 生产构建通过。

## 真实 HTTP 检查

1. 请求本地首页，确认安全响应头存在。
2. 使用 `Origin: https://evil.example` 请求 `/api/account/credits/redeem`。
3. 接口返回 HTTP 403，错误码为 `INVALID_REQUEST_ORIGIN`。

## 尚未覆盖

- Cloudflare 与 Redis 的 IP、账户、全局限流和费用熔断。
- 大型 ZIP 的 Worker 异步归档。
- 生产容器、私有网络、密钥托管、备份恢复和监控告警。
- 正式域名反向代理下的 Host/Proto、TLS 与 HSTS 验收。

这些项目完成前，不能将当前版本标记为完整 Production。
