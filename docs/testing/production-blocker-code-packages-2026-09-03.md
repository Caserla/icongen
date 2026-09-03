# 三个生产阻断项代码包与验收用例

更新时间：2026-09-03

这些脚本会创建和删除测试用户、任务、账本及 Storage 对象，只允许用于空白或隔离的 staging Supabase。脚本默认拒绝执行，必须同时提供 staging 标记和明确的破坏性测试确认值。

## 统一执行条件

```bash
export SECURITY_TEST_ENVIRONMENT=staging
export SECURITY_TEST_CONFIRM_MUTATION=YES_I_UNDERSTAND_STAGING_ONLY
export SECURITY_TEST_SUPABASE_URL=https://YOUR-STAGING-PROJECT.supabase.co
export SECURITY_TEST_SUPABASE_ANON_KEY=YOUR-STAGING-ANON-KEY
export SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY=YOUR-STAGING-SERVICE-ROLE-KEY
```

执行前确认 staging 已应用迁移 `0018`、`0020`、`0021` 和 `0022`，并且没有需要保留的 queued/processing 任务。三个脚本均使用随机测试账户并在 `finally` 中清理数据；成本脚本还会恢复运行限制原值。

## 代码包一：运行时成本熔断

命令：`npm run test:security:cost`

覆盖：

1. 阈值内创建一个主体，任务创建成功且只扣 1 点。
2. 同一用户超过每日主体限制，数据库返回 `GENERATION_USER_DAILY_LIMIT`。
3. 被拒绝的任务不创建、账户余额不变化。
4. 全局存在一个活动任务时，第二个账户创建任务返回 `GENERATION_GLOBAL_CONCURRENCY_LIMIT`。
5. 容量拒绝不扣点。
6. 无论成功或失败，恢复测试前的 `generation_runtime_limits`。

通过标准：脚本输出 `userDailyLimit`、`concurrencyLimit` 和 `rejectedDebit` 全部为 `passed`。

## 代码包二：双账户 RLS 与 Storage 隔离

命令：`npm run test:security:rls`

覆盖：

1. 创建 Owner 和 Stranger 两个真实 Auth 测试账户。
2. Owner 可读取自己的 job、subject、variant 和 asset。
3. Stranger 对相同 UUID 查询只能得到空结果。
4. Owner 可以下载自己的私有 Storage 对象。
5. Stranger 无法下载该对象，也无法为该对象创建签名 URL。

通过标准：脚本输出 `databaseRls`、`storageRls` 和 `signedUrlIsolation` 全部为 `passed`。

## 代码包三：双 Worker 并发领取与故障接管

命令：`npm run test:security:worker`

覆盖：

1. 两个 Worker 同时调用 `claim_next_worker_task`，目标任务只能被一个 Worker 领取。
2. 强制模拟持有者租约过期，备用 Worker 必须成功接管同一任务。
3. 接管后，旧 Worker 使用旧 owner 条件续租必须影响 0 行。
4. Worker Repository 在每次状态、资产和进度写入前验证 owner 与租约时间；失去租约后抛出 `WORKER_LEASE_LOST`，不能继续发布数据库结果或执行失败返还。

通过标准：脚本输出 `atomicClaim`、`expiredLeaseTakeover` 和 `staleHeartbeatFenced` 全部为 `passed`。

生产建议使用：

```bash
docker compose -f compose.basic.yml up -d --scale worker=2
```

## 完整执行与回归

```bash
npm run test:security:staging
npm test
npm run typecheck
npm run lint
npm run build
docker compose -f compose.basic.yml config
```

staging 集成脚本通过后，仍需由运维人员保存执行时间、测试项目 ID、日志摘要和负责人签字，才能把对应阻断项标记为生产验收完成。
