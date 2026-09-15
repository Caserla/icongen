# 单台 4 GB VPS 合并部署操作手册

本文是 EASY DESIGN / ICON GEN 小规模受邀测试环境的逐步操作手册。目标是在一台东京 4 GB VPS 上合并运行 Caddy、Next.js Web/BFF、Icon Worker、Sub2API、Sub2API PostgreSQL 和 Redis；业务认证、数据库和图片资产继续使用 Supabase。

## 0. 部署前必须关闭的代码缺口

开始购买和配置服务器前，先完成以下两项：

1. 为 EASY DESIGN / ICON GEN Monorepo 增加可重复构建的生产镜像定义，至少生成 `web` 和 `worker` 两个镜像/启动目标。
2. 实现生产 Worker 常驻执行器。当前 `startLocalGenerationJob` 在 `NODE_ENV=production` 时不会启动任务；执行器必须原子领取 Supabase `queued` 任务、全局并发 1、支持重启恢复并跳过已完成 variant。

在这两项完成前，可以先配置服务器、域名、Supabase 和 Sub2API，但完整图片生成任务会停在 `queued`。

## 1. 账号、网址和预算

| 服务 | 操作入口 | 用途 |
| --- | --- | --- |
| AWS Lightsail | <https://lightsail.aws.amazon.com/> | 东京 4 GB VPS、静态 IPv4、网络防火墙 |
| AWS Lightsail 价格 | <https://aws.amazon.com/lightsail/pricing/> | 核对下单时的月费；4 GB Linux/IPv4 同档参考约 USD 24/月 |
| Cloudflare Dashboard | <https://dash.cloudflare.com/> | 域名、DNS、可选代理 |
| Cloudflare Registrar | <https://dash.cloudflare.com/?to=/:account/domains/register> | 注册域名；域名通常按年付费 |
| Supabase Dashboard | <https://supabase.com/dashboard/projects> | Auth、PostgreSQL、私有 Storage 和服务端密钥 |
| Docker Ubuntu安装文档 | <https://docs.docker.com/engine/install/ubuntu/> | 安装 Docker Engine 和 Compose Plugin |
| Caddy HTTPS文档 | <https://caddyserver.com/docs/automatic-https> | 自动申请和续期 HTTPS 证书 |

基础设施月预算约为：VPS 人民币 170–180 元，加域名月均、备份和少量浮动后按 180–220 元准备。上游图片模型调用费用另计。

## 2. 创建东京 Lightsail 实例

1. 打开 [Lightsail控制台](https://lightsail.aws.amazon.com/)，选择 **Create instance**。
2. Region 选择 **Tokyo / ap-northeast-1**。
3. Platform 选择 **Linux/Unix**。
4. Blueprint 选择 **OS Only → Ubuntu 24.04 LTS**；不要选预装 WordPress、Node 或数据库的镜像。
5. 套餐选择带公网 IPv4 的 **4 GB RAM / 2 vCPU / 约 80 GB SSD** 档。
6. 实例名称建议为 `easy-design-test-tokyo-01`。
7. 创建后进入 **Networking → Create static IP**，在东京区域创建并绑定到该实例。Lightsail动态公网IP可能在停止/启动后变化，正式DNS应指向静态IP。AWS步骤见[静态IP官方文档](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html)。

## 3. 配置 Lightsail 防火墙

进入实例的 **Networking** 页面，保留以下入站规则：

| 端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 | 仅管理员当前公网 IP `/32` | SSH |
| TCP 80 | 所有 IPv4/IPv6 | HTTP跳转与ACME证书校验 |
| TCP 443 | 所有 IPv4/IPv6 | HTTPS网站 |

删除对所有人开放的22规则，不添加8080、3000、5432、6379。Lightsail的IPv4与IPv6防火墙彼此独立，需要分别检查；AWS说明见[Lightsail防火墙文档](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html)。

## 4. 配置域名和DNS

以下以 `example.com` 代替正式域名：

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 添加域名并按提示修改注册商Nameserver。
2. 打开 **DNS → Records**。
3. 新增 `A` 记录：Name=`@`，Content=`<LIGHTSAIL_STATIC_IP>`。
4. 新增 `CNAME` 记录：Name=`www`，Target=`example.com`。
5. 首次申请Caddy证书时建议先使用 **DNS only**；HTTPS验证通过后，再按大陆三网实测决定是否打开Cloudflare代理。
6. 不为Sub2API API添加公开DNS记录。若确实需要远程管理，单独使用 `sub2api-admin.example.com`，并在Caddy增加IP白名单或额外认证。

Cloudflare记录字段和代理差异见[DNS记录文档](https://developers.cloudflare.com/dns/manage-dns-records/)与[代理状态文档](https://developers.cloudflare.com/dns/proxy-status/)。

## 5. 首次登录和系统加固

从Lightsail网页终端登录，或下载SSH密钥后执行：

```bash
ssh -i /path/to/lightsail-key.pem ubuntu@<LIGHTSAIL_STATIC_IP>
```

进入服务器后：

```bash
sudo apt update
sudo apt full-upgrade -y
sudo timedatectl set-timezone Asia/Shanghai
sudo apt install -y ca-certificates curl git jq ufw unattended-upgrades
```

配置2–4 GB swap。本例使用4 GB：

```bash
sudo fallocate -l 4G /swap-easy-design
sudo chmod 600 /swap-easy-design
sudo mkswap /swap-easy-design
sudo swapon /swap-easy-design
echo '/swap-easy-design none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

配置主机防火墙作为第二层保护：

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from <ADMIN_PUBLIC_IP>/32 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

启用系统安全更新，并确认SSH只使用密钥。修改SSH配置前保持当前会话不要退出，另开一个终端验证新连接成功，避免把自己锁在服务器外。

## 6. 安装Docker和Compose

按照[Docker官方Ubuntu安装说明](https://docs.docker.com/engine/install/ubuntu/)安装，不使用旧版独立`docker-compose`：

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
echo "Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc" | sudo tee /etc/apt/sources.list.d/docker.sources
```

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
```

测试环境可以继续使用`sudo docker`，减少把普通用户加入高权限Docker组带来的额外风险。

## 7. 创建部署目录

```bash
sudo install -d -m 0750 -o ubuntu -g ubuntu /opt/easy-design-stack
cd /opt/easy-design-stack
mkdir -p easy-design sub2api caddy backups/postgres
```

目录职责：

```text
/opt/easy-design-stack/
├── compose.yml
├── .env                 # 仅服务器保存，权限600
├── easy-design/              # EASY DESIGN / ICON GEN源码或构建上下文
├── sub2api/             # Sub2API配置，不携带本地旧数据目录
├── caddy/Caddyfile
├── caddy/data/          # TLS证书持久化
└── backups/postgres/    # Sub2API PostgreSQL逻辑备份
```

将EASY DESIGN / ICON GEN代码通过私有Git仓库克隆到`/opt/easy-design-stack/easy-design`。迁移现有Sub2API部署资料时，只复制审核后的Compose与配置模板；不要直接把本地`.env`、`data/config.yaml`、运行中的`postgres_data`或`redis_data`打包上传。

## 8. 生成并保存密钥

在服务器终端分别生成随机值：

```bash
openssl rand -hex 32
```

至少需要独立生成：

- `SUB2API_POSTGRES_PASSWORD`
- `SUB2API_REDIS_PASSWORD`
- `SUB2API_JWT_SECRET`
- `SUB2API_TOTP_ENCRYPTION_KEY`
- `SUB2API_ADMIN_PASSWORD`
- EASY DESIGN / ICON GEN专用Sub2API API Key（在Sub2API管理端创建，不复用管理员凭据）

将真实值放入`/opt/easy-design-stack/.env`，然后执行：

```bash
chmod 600 /opt/easy-design-stack/.env
```

不要在命令历史、Git、截图、聊天或前端`NEXT_PUBLIC_*`变量中放置这些密钥。

## 9. 合并Compose的服务和资源限制

最终`compose.yml`至少包含：

- `caddy`
- `web`
- `worker`
- `sub2api`
- `sub2api-postgres`
- `sub2api-redis`

所有服务加入同一个私有网络，例如`easy-design-internal`。只有Caddy映射宿主机80/443；如需SSH隧道访问Sub2API管理端，可将Sub2API端口绑定为`127.0.0.1:8080:8080`，禁止使用`0.0.0.0:8080:8080`。

4 GB测试参数起点：

```env
POSTGRES_MAX_CONNECTIONS=100
POSTGRES_SHARED_BUFFERS=256MB
POSTGRES_EFFECTIVE_CACHE_SIZE=1536MB
POSTGRES_MAINTENANCE_WORK_MEM=64MB
DATABASE_HOST=sub2api-postgres
DATABASE_MAX_OPEN_CONNS=20
DATABASE_MAX_IDLE_CONNS=5
REDIS_HOST=sub2api-redis
REDIS_POOL_SIZE=32
REDIS_MIN_IDLE_CONNS=5
GATEWAY_IMAGE_CONCURRENCY_ENABLED=true
GATEWAY_IMAGE_CONCURRENCY_MAX_CONCURRENT_REQUESTS=1
```

Worker配置：

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2.5-flare
IMAGE_QUALITY=high
IMAGE_SIZE=2048x2048
IMAGE_PROVIDER_BASE_URL=http://sub2api:8080/v1
IMAGE_PROVIDER_API_KEY=<EASY DESIGN / ICON GEN_SUB2API_KEY>
ICON_SKILL=default-ui-icon
SUPABASE_URL=<SUPABASE_PROJECT_URL>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
SUPABASE_ICON_BUCKET=generated-icons
GENERATION_MAX_ATTEMPTS=3
```

Web配置至少包括：

```env
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_SUPABASE_URL=<SUPABASE_PROJECT_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```


## 10. 配置Caddy

`/opt/easy-design-stack/caddy/Caddyfile`使用：

```caddyfile
example.com, www.example.com {
    encode zstd gzip
    reverse_proxy web:3000
}
```

Caddy容器持久化`/data`和`/config`，并映射宿主机80/443。只要DNS已经指向静态IP、80/443可访问且Caddy数据目录可写，Caddy会自动申请证书、跳转HTTPS并自动续期，见[Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)。

Sub2API不需要公网域名。临时管理时使用SSH隧道：

```bash
ssh -L 18080:127.0.0.1:8080 -i /path/to/lightsail-key.pem ubuntu@<LIGHTSAIL_STATIC_IP>
```

然后只在管理员电脑访问`http://127.0.0.1:18080`。

## 11. 配置Supabase

1. 打开 [Supabase项目列表](https://supabase.com/dashboard/projects)，进入测试项目。
2. 在 **Authentication → URL Configuration** 设置：
   - Site URL：`https://example.com`
   - Redirect URL：`https://example.com/auth/callback`
   - 本地开发按需保留`http://localhost:3000/**`
3. 官方建议生产环境使用精确回调URL，见[Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)。
4. 确认项目迁移函数、RLS和新用户赠点已执行。
5. 在 **Storage** 确认`generated-icons`为Private Bucket。私有桶访问受RLS控制，下载使用短时签名URL，见[Supabase Private Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)。
6. Service Role只进入Web/Worker服务端环境，不进入浏览器或公开日志。

## 12. 首次启动

生产镜像和Worker执行器完成后：

```bash
cd /opt/easy-design-stack
sudo docker compose --env-file .env config
sudo docker compose --env-file .env pull
sudo docker compose --env-file .env build web worker
sudo docker compose --env-file .env up -d
sudo docker compose ps
```

检查日志时不要直接复制包含密钥或用户内容的完整日志：

```bash
sudo docker compose logs --tail=100 caddy
sudo docker compose logs --tail=100 web
sudo docker compose logs --tail=100 worker
sudo docker compose logs --tail=100 sub2api
```

## 13. 验收顺序

按以下顺序逐项通过，不要一开始就开放注册：

1. `https://example.com`返回200并自动跳转HTTPS。
2. 注册、验证邮件、登录、退出和重置密码正常。
3. Supabase数据库、RLS和Private Bucket正常。
4. Sub2API健康检查正常；PostgreSQL/Redis端口从公网不可达。
5. 使用EASY DESIGN / ICON GEN专用Key向Sub2API发起一条最小图片请求。
6. 创建一个仅含1个主体的EASY DESIGN / ICON GEN任务，确认状态依次进入`queued → processing → completed`。
7. 验证3个variant、预览、单图和ZIP下载。
8. 重启Worker，确认未完成任务可恢复且不重复扣点/重复生成完成项。
9. 分别使用中国电信、联通、移动测试首页、注册、生成、进度和下载。
10. 再逐步把单批限制放宽到3个主体，期间观察内存、swap、CPU和模型费用。

常用检查：

```bash
free -h
df -h
sudo docker stats --no-stream
sudo docker compose ps
curl -I https://example.com
```

## 14. 备份

Supabase按其项目策略备份业务数据。VPS侧必须单独备份Sub2API数据库和配置。

每天执行PostgreSQL逻辑备份，不直接复制运行中的PostgreSQL数据目录：

```bash
cd /opt/easy-design-stack
sudo docker compose exec -T sub2api-postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "backups/postgres/sub2api-$(date +%F).sql.gz"
```

备份文件应加密后复制到另一存储位置，并设置保留期限。至少做一次恢复演练；没有验证恢复的备份不算完成。

仓库同时提供面向任意 PostgreSQL 连接的加密备份与隔离恢复脚本。密钥文件必须位于仓库外并限制为当前运维用户读取：

```bash
export PRODUCTION_DATABASE_URL='postgresql://...'
export BACKUP_DIRECTORY='/opt/easy-design-stack/backups/postgres'
export BACKUP_ENCRYPTION_PASSPHRASE_FILE='/run/secrets/icongen-backup-passphrase'
./scripts/backup-postgres-encrypted.sh
```

恢复测试具有破坏性，只能指向一次性的隔离数据库；脚本会拒绝与 `PRODUCTION_DATABASE_URL` 完全相同的地址：

```bash
export RESTORE_DATABASE_URL='postgresql://.../disposable_restore_test'
export ENCRYPTED_BACKUP_FILE='/path/to/icongen-postgres-TIMESTAMP.dump.enc'
export ALLOW_DESTRUCTIVE_RESTORE_TEST=yes
./scripts/verify-postgres-restore.sh
```

恢复完成后记录备份时间、恢复耗时、抽查行数、RPO/RTO 和执行人。Supabase Storage 图片仍需使用平台备份或对象存储复制方案单独保护。

## 15. 更新、回滚和停止计费

更新前先做数据库备份，然后：

```bash
cd /opt/easy-design-stack/easy-design
git fetch --all --prune
cd /opt/easy-design-stack
sudo docker compose --env-file .env build web worker
sudo docker compose --env-file .env up -d
```

镜像和代码都使用明确版本或提交，不在正式测试期间盲目跟随`latest`。回滚时切回上一个已验证提交/镜像并重新`up -d`，数据库迁移必须先确认是否可向后兼容。

测试结束后，仅停止实例通常仍会计费。确认数据已经备份或删除后，在Lightsail中删除实例、静态IP、快照和其他附属资源，并检查AWS账单页面确认没有遗留资源。

## 16. 小规模测试限制

- 只邀请少量指定账户，不开放无限注册。
- Worker全局并发1，Sub2API图片并发1。
- 每个用户最多1个活动任务。
- 单批先限制1个主体，稳定后最多3个。
- 设置Sub2API Key额度和上游模型月预算告警。
- 任何持续swap、OOM、Web明显变慢或生成失败升高都视为拆分/扩容信号。
