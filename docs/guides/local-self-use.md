# EASY ICON 本地自用与开源准备

**当前推荐：[SQLite 简化部署](simple-local.md)**，运行 `npm run dev:local`，无需注册登录、Docker 或 Supabase。下文记录旧 Supabase 兼容部署；旧数据库和文件原样保留，不是简化模式的依赖。

当前目标：先启动本地网站，再迁移到本地自托管数据库，最后审查开源发布范围。

## 启动网站

在 `apps/web` 运行 `npm run dev`，访问 http://127.0.0.1:3000 。开发启动器默认只绑定 127.0.0.1，避免默认向局域网暴露开发服务器。

模型设置放在未跟踪的 `apps/web/.env.local`，不要提交真实密钥。启动器会检查 IMAGE_PROVIDER_BASE_URL 和 IMAGE_PROVIDER_API_KEY。

## 当前边界

- 本地生成接口已移除 Creem 专用审核依赖和示例密钥配置；不影响模型供应商自身规则。
- 当前网站已切换到独立本地 Supabase；云端账户与历史数据未迁移、未删除。本地需要重新创建账户。
- 未删除 Creem 账户或撤销服务器上的密钥；未变更线上服务、账单和云端数据。
- 尚未公开 Git 仓库或选择开源许可证。

## 下一阶段

1. 单独 Docker 项目启动本地自托管 Auth、Postgres、REST、Storage；使用独立数据卷和端口，不修改其他业务容器。
2. 导入业务结构并验证本地账户、项目、生成、收藏、回收、恢复和下载；旧数据按单独清单迁移。
3. 清理商业套餐入口和云端部署默认值，保留安全校验和访问权限控制。
4. 发布前扫描 Git 历史与待提交文件的密钥、真实用户数据、私有资产、第三方素材授权；确认许可证后才发布。

## 本地服务（2026-10-14）

- 网站：http://127.0.0.1:3000/create
- Auth / REST / Storage 网关：http://127.0.0.1:18000
- 本地验证邮件：http://127.0.0.1:18025 （邮件不会发送到真实邮箱）
- 官方 Supabase 基础配置：`self-hosted/v0.8.2`，commit `564eab8ad7840b13324f68b1bfac074ef8d51c21`。仅启用 db、auth、rest、storage、imgproxy、meta、studio、api-gw，附加 Mailpit。
- 容器项目：`easy-icon-local`。运行配置和数据库目录位于 `.local/supabase`，已排除 Git；文件存储和邮件使用独立 Docker 卷。所有暴露端口只绑定 127.0.0.1，数据库不直接暴露端口。
- 邮箱验证保持开启，Google/GitHub 登录需另行配置提供商，本地默认未配置。
- 使用 `docker compose -f compose.yml up -d` 启动数据库（工作目录 `.local/supabase`）；`docker compose -f compose.yml stop` 停止。不要使用 `down -v` 或删除数据库目录，否则会丢失本地数据。
- 本地项目已导入 0001–0048 业务结构；初次导入用 `infra/supabase/easy-design-bootstrap.sql`，不能在已有数据库上重复执行。0048 停用赠点和兑换，保留历史数据。
- 初次配置：下载官方对应版本 docker 目录，执行 `node scripts/setup-local-supabase.mjs /path/to/docker`；启动并初始化后执行 `node scripts/setup-local-supabase.mjs --connect-web`，再重启前端。
- 原网站环境文件已私密备份为 `.local/supabase/web-env-before-local.backup`。不要上传该文件或 `.env`。
- 回归命令：`node --env-file=apps/web/.env.local scripts/test-local-deployment.mjs`。脚本只接受 127.0.0.1:18000，使用临时账户和文件并清理；不调用付费模型。
- 自托管不代表模型免费：生成仍使用现有外部模型接口。旧商业后台/账本结构尚保留用于兼容，后续独立清理，不代表存在本地收费套餐。
