# Supabase 自托管迁移执行记录

更新：2026-10-14。用户已同意迁移到自托管；尚未授权购买服务器、开放公网管理权限或删除云端数据。

## 当前状态

- 源项目：`ppqeevfeeoloegmotlbo`（线上预发布业务）与 `fzsfvasxlikuynjudqgd`（历史资产）。必须分别导出与核对，不能合并覆盖用户、任务或存储记录。
- 源组织存储超额，Storage API 返回 402；数据库只读 SQL 尚可查询。文件导出是否可行必须单独验证，不能声称数据已备份。
- 2026-10-14 三次 SSH 检查均被 `52.77.80.116:22` 关闭；没有变更远程服务、网络、DNS或防火墙。
- 自托管使用官方 `self-hosted/v0.8.2` 固定版本，先核对镜像与 PostgreSQL 版本，再运行。

## 部署边界

1. 独立目录、Compose 项目名、网络和数据卷；不得复用现有 PostgreSQL 数据目录。
2. 初验仅绑定 localhost；Postgres 和 Studio 不直接开放公网。不复用官方示例密码或云端服务角色密钥。
3. 先确认服务器内存、CPU、磁盘和其他业务资源。官方完整栈最低 4 GB / 2 核 / 40 GB SSD，推荐 8 GB+，不能把共享主机总内存当作可用内存。
4. Auth、REST、Postgres、Storage 是本项目需要的能力；Realtime、Functions、Analytics 等是否保留由实际调用审计决定。
5. 密钥仅保存在权限 0600 的配置文件中，禁止出现在 Git、日志、聊天或截图。

## 迁移顺序及验收

- 导出源数据库结构、用户、业务记录及存储元数据；确认源/目标 PostgreSQL 主版本兼容，按官方恢复流程处理系统角色与 Auth。
- 文件逐个复制并记录 bucket、path、bytes、SHA-256；验证文件数、容量和摘要。不以元数据导出代替真实文件备份。
- 在隔离目标恢复数据并验证 RLS、RPC、用户 UUID、点数、项目、收藏、历史修改版本、任务租约。
- 设置独立 SMTP 和正确的邮件回调。Cloudflare Email Routing 只负责收信，不能当作 SMTP 发信服务。
- 回归注册、登录、重置密码、生成、保存、收藏、回收、恢复、下载和并发重试。当前方向改为开源、本地自用，已移除支付平台专用审核依赖；模型服务自身规则仍需遵守。
- 切换前暂停写入，做增量迁移与最终校验，保留旧环境和回滚配置。公网入口和生产切换另行确认。
- 建立加密异地备份和恢复演练后，才可结束迁移；云端项目暂不删除。

## 官方参考

- https://supabase.com/docs/guides/self-hosting/docker
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/self-hosting/storage

## 待解决阻断

远程 SSH 访问恢复、部署机器选择与容量验证、云端文件导出访问、SMTP 发信配置。当前不是已完成部署。
