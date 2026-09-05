# 新加坡 Lightsail 首次部署操作日志（2026-09-05）

本文记录 `esdesign.men` 在 AWS Lightsail 新加坡节点完成的首次真实云基础设施配置。它是实际操作日志，不替代[单台 4 GB VPS 合并部署操作手册](single-vps-deployment-runbook.md)。**该服务器和域名当前明确属于预发布环境，不代表产品已正式上线。** 当前实例只有 1 GB RAM，代码侧已准备 Web、单并发 Bamboo Worker 与 Caddy 的完整预发布编排；Sub2API 及其 PostgreSQL/Redis 不在这台机器部署。四环境契约与资源限制见[环境分层与测试索引](environment-and-testing.md)。

## 0. 环境级别与发布边界

当前环境固定标记为：

```text
Environment: preproduction
Release status: internal acceptance only
Public launch: blocked
```

即使使用真实服务器、真实域名和有效 HTTPS，也必须继续满足以下预发布约束：

- 不对公众宣布正式上线；
- 不开放公开注册，测试账号使用白名单或邀请方式；
- 不接入未验收的真实支付流程；当前只允许受控 CD-Key 测试；
- 业务数据使用独立 staging/preproduction Supabase 项目，不与未来正式生产数据混用；
- AI Provider 使用独立限额 Key，设置较低额度与并发；
- 页面发送 `X-Robots-Tag: noindex, nofollow, noarchive`，并提供禁止抓取的 `robots.txt`；
- 正式应用部署后增加 Cloudflare Access 或等价访问控制；临时基础设施健康页可公开，但不得展示后台、密钥或运行信息；
- 所有邮件主题或正文标记为测试/预发布，避免用户误认为正式服务；
- 日志、告警、备份、失败恢复和回滚未验收前，不得把环境状态改为 production；
- 完整生成、扣点、返还、CD-Key、权限、并发与浏览器回归全部通过后，才允许单独执行生产发布评审。

推荐后续将应用验收入口设为 `staging.esdesign.men`，根域名 `esdesign.men` 在正式发布前只保留简洁的维护/即将上线页面。若阶段内仍使用根域名验收，也必须保留上述 noindex、访问控制和注册关闭策略。

## 1. 当前部署清单

| 项目 | 实际值 | 状态 |
| --- | --- | --- |
| 已注册域名 | `esdesign.men` | 已完成；当前用于预发布基础设施 |
| 域名注册与 DNS | Cloudflare Registrar / Cloudflare DNS | 已完成 |
| 云服务器 | AWS Lightsail | 已完成 |
| Region / AZ | Singapore / `ap-southeast-1a` | 已完成 |
| 实例 | `Ubuntu-2` | 已完成 |
| 系统 | Ubuntu，Linux operating system | 已完成 |
| 规格 | General purpose，2 vCPU / 1 GB RAM / 40 GB SSD | 临时生产规格 |
| 网络 | Dual-stack | 已完成 |
| 静态 IPv4 | `52.77.80.116` | 已绑定 |
| Swap | `/swapfile`，2 GiB | 已完成 |
| 主机防火墙 | UFW | 已完成 |
| SSH 防护 | Lightsail 来源限制、浏览器 SSH、Fail2ban | 已完成 |
| 容器运行时 | Docker Engine + Compose Plugin | 已完成 |
| HTTPS 入口 | Caddy Docker 容器 | 已完成 |
| 根域名 HTTPS | `https://esdesign.men` | 已验证；非正式发布 |
| `www` HTTPS | `https://www.esdesign.men` | 已配置 |
| API DNS | `api.esdesign.men` | 已解析，应用未部署 |

## 2. 规格选择与限制记录

原计划使用新加坡 4 GB Lightsail。AWS 新账号验证期间创建 4 GB 和 2 GB 方案均返回 HTTP 400；账号提示验证最长可能需要两天。验证状态放开后，1 GB 方案创建成功。

当前 1 GB 实例以低吞吐方式承载：

- Caddy；
- Next.js Web/BFF 的预构建生产镜像；
- `GENERATION_CONCURRENCY=1` 的 Bamboo Worker；
- 在持续监控下运行的轻量系统服务。

当前实例仍不具备把 Sub2API、Sub2API PostgreSQL 和 Redis 一并运行的稳定内存余量。完整 Sub2API 合并部署仍以 4 GB 为最低测试基线；出现 OOM、持续 Swap、502、Worker 中断或 Web 延迟时必须升级或拆分服务。

## 3. Lightsail 实例创建

控制台选择：

```text
Region: Singapore / ap-southeast-1
Platform: Linux/Unix
Blueprint: Linux operating system / Ubuntu
Plan family: General purpose
Instance: Ubuntu-2
Networking: Dual-stack
```

实例创建后，动态公网 IPv4 为 `13.212.191.225`。该地址随后被静态 IPv4 替换，不再用于 DNS 或运维。

## 4. 静态 IP

在 Lightsail **Networking → Create/Attach static IP** 中创建并绑定：

```text
Static IP name: icongen-prod-sg-ip
Attached instance: Ubuntu-2
Static IPv4: 52.77.80.116
```

验收结果：静态 IP 页面显示已关联 `Ubuntu-2`。不得点击 `Detach`；删除实例时需要同时检查并释放不再使用的静态 IP，避免产生费用。

## 5. Lightsail 云防火墙

IPv4 入站规则：

| Application | Protocol | Port | Source |
| --- | --- | --- | --- |
| SSH | TCP | 22 | 管理员当前公网 IPv4 `/32`；保留 Lightsail browser SSH IPv4 |
| HTTP | TCP | 80 | Any IPv4 |
| HTTPS | TCP | 443 | Any IPv4 |

IPv6 不开放 SSH；HTTP/HTTPS 可保留。没有开放 `3000`、`5432`、`6379`、`8000`、`8080`、`2375` 或 `2376`。

管理员公网 IP 变化时，需要先在 Lightsail 更新 SSH 来源。更新前保留已有会话，并使用第二个会话验证连接，避免锁死。

## 6. 系统初始化与 Swap

服务器执行：

```bash
sudo timedatectl set-timezone UTC
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y
sudo apt autoremove -y
sudo apt install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades
```

2 GiB Swap 已创建并写入 `/etc/fstab`：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

持久化项：

```text
/swapfile none swap sw 0 0
```

验收输出：

```text
Mem: 约 909 MiB
Swap: 2.0 GiB
/swapfile file 2G
```

## 7. UFW 与 Fail2ban

UFW 默认策略及公开端口：

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Lightsail 已作为 SSH 来源限制的第一层，UFW 为第二层。删除 UFW 的 `22/tcp (v6)` 公开规则，保留 HTTP/HTTPS IPv6 规则：

```bash
sudo ufw status numbered
sudo ufw delete <22/tcp-v6-rule-number>
```

Fail2ban 已启用：

```bash
sudo systemctl enable --now fail2ban
sudo systemctl is-active fail2ban
```

验收结果为 `active`。

## 8. Docker 安装与保护

使用 Docker 官方 Ubuntu 软件源安装：

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker containerd
sudo usermod -aG docker ubuntu
```

重新登录后执行：

```bash
docker run --rm hello-world
```

验收结果显示 `Hello from Docker!`，证明客户端、Daemon、镜像拉取和容器运行正常。

Docker 日志轮转配置为本地驱动、单文件 10 MB、保留 3 份，并启用 `live-restore`：

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
```

配置文件位置：`/etc/docker/daemon.json`。使用以下命令验收：

```bash
sudo dockerd --validate --config-file=/etc/docker/daemon.json
sudo systemctl restart docker
docker info --format '{{.LoggingDriver}}'
```

## 9. Cloudflare DNS

正式记录：

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | `52.77.80.116` | DNS only |
| CNAME | `www` | `esdesign.men` | DNS only |
| A | `api` | `52.77.80.116` | DNS only |

暂未添加 `AAAA`，暂未开启 Cloudflare 橙云代理。Mac 本地验收：

```bash
dig +short esdesign.men A
dig +short www.esdesign.men
dig +short api.esdesign.men A
```

实际结果：根域名和 API 返回 `52.77.80.116`；`www` 先返回 `esdesign.men.`，随后解析到同一静态 IP。

## 10. Caddy 与 HTTPS

创建目录：

```bash
sudo install -d -m 0750 -o ubuntu -g ubuntu /opt/bamboo-stack/caddy
```

当前临时 `/opt/bamboo-stack/caddy/Caddyfile`：

```caddyfile
esdesign.men, www.esdesign.men {
    encode zstd gzip
    respond "ES Design deployment endpoint is ready." 200
}
```

启动命令：

```bash
docker run -d \
  --name caddy \
  --restart unless-stopped \
  --memory=96m \
  --cpus=0.25 \
  -p 80:80 \
  -p 443:443 \
  -v /opt/bamboo-stack/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2-alpine
```

验收地址：

- `https://esdesign.men`
- `https://www.esdesign.men`

2026-09-05 已在浏览器确认根域名可以通过 HTTPS 打开，临时响应正常，域名、静态 IP、80/443 防火墙和 Caddy 自动证书链路已打通。该结果只证明预发布基础设施入口可用，不表示业务应用已正式上线。

## 11. 当前安全边界

- Cloudflare 当前为 DNS only，因此源站静态 IP 可由公开 DNS 查询；Lightsail 与 UFW 必须持续作为入口保护。
- 只有 Caddy 可以映射宿主机 `80/443`；未来 Next.js 只加入 Docker 私有网络，不公开 `3000`。
- Sub2API、PostgreSQL、Redis 不得映射公网端口。
- SSH 私钥、Supabase Service Role、模型 API Key 和 Sub2API 管理密钥不得写入 Git、聊天、截图或 `NEXT_PUBLIC_*` 环境变量。
- 当前 Caddy 页面只是基础设施验收页，不代表 Bamboo Web、认证、生成、扣点或恢复链路已经上线。
- 当前环境必须使用 `APP_ENV=preproduction`（或项目最终统一的等价变量），禁止伪装为 production 环境写入正式业务数据。

## 12. 后续操作

按顺序继续：

1. 为 `web` 生成可重复构建的生产镜像，优先在 CI 构建，避免 1 GB 主机执行 Next.js 编译。
2. 将临时 Caddy 响应替换为 `reverse_proxy web:3000`，Web 与 Caddy 通过私有 Docker 网络通信。
3. 创建或核对 Supabase 新加坡生产项目，执行迁移、RLS 和私有 Storage 验收。
4. 创建独立预发布 Supabase 项目；将预发布 Site URL 设置为实际验收域名，Redirect URL 设置为对应 `/auth/callback`，不得覆盖未来正式生产项目配置。
5. 配置生产 SMTP、SPF、DKIM、DMARC。
6. AWS 允许更大规格后升级到至少 4 GB，或为 Worker/Sub2API 建立独立节点。
7. 部署常驻 Worker 与 Sub2API 前，完成健康检查、内存限制、私网、备份和失败恢复验收。
8. 最后执行注册、登录、CD-Key、真实扣点、生成、免费重试、细节调整、失败返还和任务恢复的完整生产回归。
9. 另行召开生产发布评审；只有发布阻断项清零并得到人工确认后，才将环境标识、访问策略和域名入口切换为 production。
