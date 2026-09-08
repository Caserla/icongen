# 生产环境安全加固与人工操作清单

更新时间：2026-09-03

适用范围：EASY DESIGN / ICON GEN 面向海外正式用户、部署到公网云服务器时的 Web、API、Worker、Supabase、Storage、模型网关、支付和运维安全。

## 1. 标记说明

| 标记 | 含义 |
| --- | --- |
| `代码` | 可在代码仓库内实现和自动化验证 |
| `人工` | 必须由项目所有者在云平台、域名、支付或账号控制台完成 |
| `联合` | 先完成代码，再由人工配置生产环境并提供验收凭证 |
| `阻断上线` | 未完成前不得开放对应生产能力 |

## 2. 当前安全基线

- API 使用 Supabase 服务端会话验证，受保护操作要求已验证且状态正常的账户。
- 管理页面检查 Supabase `app_metadata.role=admin`。
- 用户资源读取在使用 Admin Client 时仍显式核对 `user_id`；数据库同时启用 RLS。
- 生成图片 Bucket 为私有 Bucket，浏览器通过短期签名 URL 访问。
- 首次生成扣点、任务创建、账本写入与幂等检查在数据库事务中完成。
- CD-Key 只保存哈希和末四位提示，兑换使用行锁和唯一流水。
- 完整生成 Prompt 已停止写入用户可读业务表；迁移 `0019_remove_persisted_generation_prompts.sql` 已在 Supabase 执行，历史 Prompt 字段已清理。
- 公共生成设置只返回稳定选项 ID、展示文本和预览资产，不再向浏览器返回 `promptToken`；完整风格协议仅由 Worker 在内存中编译。
- 供应商错误写入用户可读记录前会转换为产品自有安全文案，Worker 日志同时过滤嵌入错误字符串的 Prompt、Token 和 API Key。
- Web 使用 Next standalone 独立镜像，镜像内不包含 `icon-skill` 源码、完整 Prompt 或参考图库；这些内容只存在于 Worker 镜像。所有层级的 `.env*` 文件均被排除在 Docker build context 之外。
- 2026-09-03 执行 `npm audit --omit=dev`，生产依赖未发现已知漏洞。

这些措施是安全基础，不代表已达到公网生产上线条件。

## 3. 上线阻断项

| 编号 | 类型 | 工作项 | 当前状态 | 完成标准 | 人工干预 |
| --- | --- | --- | --- | --- | --- |
| SEC-P0-001 | 联合 | 统一限流与防刷 | 代码底座及 staging 验收包完成，待迁移、定值和实测 | 单机 Web 已对全部 API 写请求限流；迁移 `0021` 增加数据库级全局并发、全局每日/月度主体数、用户每日主体数原子熔断；`test:security:cost` 验证拒绝不扣点；边缘/IP 分布式限流仍需 Cloudflare 或 Redis | **需要**：在 staging 执行 `0021` 和验收包；确定并启用生产阈值；创建 Cloudflare 规则；多 Web 实例时准备 Redis |
| SEC-P0-002 | 代码 | ZIP 下载资源保护 | **安全闭环完成** | 已限制单次最多 20 个方案、单资源 16 MiB、归档输入总量 64 MiB，超限直接拒绝；大包异步生成属于后续性能优化，不再阻断安全上线 | 不需要 |
| SEC-P0-003 | 联合 | 生产 Worker 常驻执行器 | 代码底座、写入前租约校验及 staging 故障验收包完成，待真实演练 | 迁移 `0020` 使用 `FOR UPDATE SKIP LOCKED` 原子领取任务，提供租约续期和过期回收；Repository 写入前校验 owner/expiry，旧 Worker 失权后不能发布数据库结果；`test:security:worker` 覆盖并发领取、过期接管和旧 owner 续租拒绝 | **需要**：在 staging 执行 `0020` 和验收包；云服务器至少启动两个 Worker，并补做进程强杀演练 |
| SEC-P0-004 | 联合 | 生产容器与网络隔离 | 仓库模板加固完成 | Web/Worker 使用不同镜像 target；Web standalone 镜像不含 Prompt 包；`.env*` 不进入构建上下文；容器使用非 root、只读根文件系统、临时写目录、移除 capabilities、PID/CPU/内存限制；仅 Caddy 暴露 80/443 | **需要**：配置真实安全组、SSH、私有网络并执行公网端口扫描和资源限制验收 |
| SEC-P0-006 | 联合 | 生产密钥管理 | 本地 `.env` 方案 | 密钥不进入镜像、Git、日志和客户端包；按服务拆分；有轮换和吊销流程 | **需要**：在云密钥服务或 Docker secrets 写入真实密钥并完成首次轮换演练 |

## 4. 高优先级加固

| 编号 | 类型 | 工作项 | 完成标准 | 人工干预 |
| --- | --- | --- | --- | --- |
| SEC-P1-001 | 代码 | 安全响应头 | **代码完成**：CSP、HSTS、`nosniff`、`frame-ancestors`、Referrer Policy、Permissions Policy 已返回；生产域名上线后复验 | 不需要 |
| SEC-P1-002 | 联合 | 请求来源和 CSRF 防护 | **代码完成**：API 写请求验证 Origin/Host 与 `Sec-Fetch-Site`、有请求体时强制 JSON、1 MiB 请求体上限；生产反向代理需正确传递 Host/Proto 后复验 | **需要**：提供最终生产域名和允许的回调域名 |
| SEC-P1-003 | 代码 | Service Role 权限收缩 | 普通资产预览、列表、摘要和详情数据查询均使用 Session + RLS；仅已验证归属的 Storage 路径交由独立 Admin signer，下载和写操作仍保留显式用户归属校验；测试固定允许清单，新增高权限消费者会导致 CI 失败 | 不需要，但部署后需人工轮换旧 Service Role |
| SEC-P1-004 | 联合 | CD-Key 防猜测 | 兑换码随机空间提升到至少 128 bit；账户/IP 失败限流；异常尝试审计和告警 | **需要**：确定冻结阈值、客服解锁流程和告警接收人 |
| SEC-P1-005 | 代码 | 日志脱敏 | **代码闭环完成**：Worker 与 Web/BFF 统一过滤密钥字段、Bearer 凭据、签名查询参数、邮箱、Prompt 与调整指令；已有泄漏回归测试 | 不需要 |
| SEC-P1-006 | 联合 | 管理员安全 | 管理员账户强制 MFA；角色变更有审计；后台入口增加独立访问策略 | **需要**：指定管理员、启用 MFA、保管恢复码、配置 Cloudflare Access 或 VPN |
| SEC-P1-007 | 联合 | 模型费用保护 | 账户、IP、全局并发和日/月预算四层限制；异常消费自动暂停而不是继续调用模型 | **需要**：确定预算上限、暂停策略和人工恢复流程 |

## 5. 运维、数据与合规

| 编号 | 类型 | 工作项 | 完成标准 | 人工干预 |
| --- | --- | --- | --- | --- |
| OPS-001 | 人工 | 云服务器防火墙 | 公网仅开放 80/443；22 仅管理员 IP、VPN 或 Tailscale；Redis、PostgreSQL、Sub2API 不暴露公网 | **需要** |
| OPS-002 | 联合 | TLS 与域名 | 正式域名、HTTPS、自动续期、HTTP 跳转、HSTS 和回源保护验证通过 | **需要**：购买/配置域名、DNS 和 Cloudflare |
| OPS-003 | 人工 | Supabase 生产配置 | Site URL、Redirect URL、SMTP、RLS、私有 Bucket、数据库备份和区域选择完成 | **需要** |
| OPS-004 | 联合 | 备份与恢复 | 已提供 PostgreSQL AES-256 加密备份、校验和及隔离库恢复验证脚本；仍需启用 Supabase PITR/Storage 备份并完成真实恢复演练 | **需要**：选择备份位置、密钥和保留期限，参与恢复演练 |
| OPS-005 | 联合 | 监控与告警 | 已增加 Token 保护的数据库 readiness 接口；仍需覆盖 5xx、登录失败、CD-Key 猜测、队列积压、模型费用、CPU、内存、磁盘、OOM、证书和备份失败 | **需要**：设置独立 `HEALTHCHECK_TOKEN`，指定告警接收人和升级路径 |
| OPS-007 | 人工 | 海外隐私与条款 | 隐私政策、服务条款、退款规则、供应商清单、跨境数据说明和联系渠道上线 | **需要**：运营/法律审核 |
| OPS-008 | 联合 | CI/CD 供应链安全 | 分支保护、强制 Review、测试、依赖审计、密钥扫描、SBOM、镜像扫描和受控发布 | **需要**：配置 GitHub 仓库规则和生产部署凭据 |

## 6. 推荐生产拓扑

```text
用户
  ↓
Cloudflare DNS / WAF / Rate Limit
  ↓
Caddy HTTPS（唯一公网入口）
  ↓
Next.js Web/BFF ───── Supabase Auth / PostgreSQL / Private Storage
  │
  └── 写入任务队列
          ↓
      独立 Worker
          ↓
  私有 Sub2API Gateway
          ↓
        Image2
```

网络边界：

- Caddy 可访问 Web。
- Web 可访问 Supabase，不直接访问 Sub2API 和模型供应商。
- Worker 可访问 Supabase 和 Sub2API。
- Sub2API 可访问其专用 PostgreSQL、Redis 和上游模型。
- PostgreSQL、Redis 和 Sub2API 管理端不允许公网访问。

## 7. 人工操作总表

以下项目无法仅靠提交代码完成：

1. 购买或准备云服务器，并配置区域、磁盘、快照和安全组。
2. 配置 SSH 密钥、管理员来源限制、UFW/Tailscale 和系统自动安全更新。
3. 购买或确定正式域名，配置 Cloudflare DNS、WAF、限流与回源策略。
4. 创建生产 Supabase 项目或确认现有项目可用于生产，配置区域、Auth URL、SMTP、备份和 Storage。
7. 指定管理员账户并启用 MFA，保存恢复码。
8. 确定模型日/月预算、用户异常阈值、自动暂停和人工解封流程。
9. 确定数据保留期限、隐私政策、服务条款、退款规则和支持邮箱。
10. 指定监控告警接收人，执行一次主机重启、Worker 恢复、数据库恢复和密钥轮换演练。

## 8. 实施顺序

### 阶段 A：代码安全底座

- SEC-P0-001 应用层限流
- SEC-P0-002 ZIP 异步化与资源上限
- SEC-P1-001 安全响应头
- SEC-P1-002 Origin、Content-Type 与请求体限制
- SEC-P1-003 Service Role 收缩
- SEC-P1-004 CD-Key 防猜测
- SEC-P1-005 日志脱敏

### 阶段 B：生产运行能力

- SEC-P0-003 生产 Worker
- SEC-P0-004 容器和私有网络
- OPS-001～OPS-005 防火墙、TLS、Supabase、备份和监控

### 阶段 C：商业上线能力

- SEC-P1-006 管理员安全
- SEC-P1-007 模型预算保护
- OPS-006～OPS-008 数据治理、法律文本和 CI/CD

## 9. 正式上线判定

只有满足以下条件才可以把环境标记为 Production：

- 所有 `SEC-P0` 项完成。
- 不存在公网 Redis、PostgreSQL、Sub2API 或管理端口。
- 真实完成一次支付重放测试、失败退款测试、Worker 重启恢复测试和数据库恢复测试。
- 限流、费用阈值和监控告警已由指定人员实际接收并确认。
- 隐私政策、服务条款、退款规则和支持渠道已经公开可访问。

## 10. 当前上线阻断项执行清单

更新时间：2026-09-03。以下仅列仍未形成生产级闭环的项目；Prompt 清理迁移已经完成，不再属于上线阻断项。

| 优先级 | 阻断项 | 当前缺口 | 解除阻断的验收证据 | 责任类型 |
| --- | --- | --- | --- | --- |
| P0 | 分布式限流与模型费用熔断 | 数据库原子并发/日用量熔断代码已完成；`0021` 尚未执行和启用，月度金额熔断、边缘 IP 限流与告警仍待生产配置 | 执行 `0021`；超限分别返回稳定 `429/503`；模型预算触发后真实停止调用并产生告警 | 部署 + 人工定值 |
| P0 | Worker 持久队列与租约 | 原子领取、续租、过期回收代码已完成；`0020` 尚未执行，双 Worker 和强杀恢复尚未在生产环境验收，死信告警仍待监控接入 | 执行 `0020`；双 Worker 竞争、进程中断续跑、重复领取幂等、租约回收和死信告警全部通过 | 部署 + 演练 |
| P0 | 生产服务器与网络隔离 | 仓库 Compose 已完成只读容器、capability、PID/CPU/内存和临时目录限制；真实安全组、SSH 来源和私有网络尚未验收 | 端口扫描仅见 80/443；SSH 受限；数据库、Redis、Sub2API 和管理端不可公网访问 | 人工 |
| P0 | 生产密钥托管与轮换 | 仍以环境变量文件为主，尚未完成服务拆分、托管、首次轮换和吊销演练 | Git/镜像/客户端/日志扫描无密钥；Web 与 Worker 密钥隔离；轮换后服务不中断 | 联合 |
| P0 | 数据库、Storage 备份恢复 | 尚无真实恢复演练和确认后的 RPO/RTO | 从备份恢复用户、点数账本、任务和图片；形成恢复记录及时间指标 | 联合 |
| P0 | 监控、告警与费用异常响应 | 缺少覆盖 5xx、Worker、队列、模型费用、主机资源、证书和备份的统一告警闭环 | 每类告警至少真实触发一次并由指定人员确认收到；具备升级和恢复流程 | 联合 |
| P1 | Web/BFF 日志全量脱敏 | **代码完成**：现有错误日志已统一进入结构化脱敏器，自动测试覆盖 Prompt、Token、签名 URL、邮箱和 API Key | 接入正式错误平台后再次注入模拟敏感值，确认平台中不出现原文 | 部署验收 |
| P1 | Service Role 最小权限 | 普通资产预览、列表、摘要和详情数据查询已迁移到 Session + RLS，并由允许清单测试防止权限重新扩张；Admin 仅负责已验证路径的 Storage 签名，下载和写操作仍显式校验 `user_id` | 完成本人/跨账户普通资产与 revision 对象测试；验证后轮换旧 Service Role | 部署验收 |
| P1 | 大型 ZIP 异步化 | 已有数量和内存硬上限，但归档仍可能占用 Web 进程 | 大包转为 Worker 异步归档；并发压测不拖慢 Web；临时文件自动清理 | 代码 |
| P1 | 管理员账户保护 | MFA、后台独立访问边界和角色变更审计尚未实际启用 | 管理员 MFA、恢复码、Cloudflare Access/VPN 和角色审计记录可验证 | 人工 |
| P1 | CI/CD 供应链安全 | 仓库已增加 Security CI（生产依赖审计、测试、类型检查、Lint、构建、Compose 校验）；分支保护、密钥扫描、SBOM、镜像扫描和受控回滚尚未完成 | 主分支保护生效；PR 必须通过测试/扫描；生产镜像可追溯且完成一次回滚演练 | 联合 |
| P1 | 数据保留与海外合规 | 未最终确定图片、调整版本、日志和删除期限；法律文本未上线 | 自动清理任务通过；隐私政策、条款、退款规则、供应商和跨境数据说明公开 | 联合 |
| P1 | Image2/Sub2API 数据处理边界 | 尚未确认供应商请求保留、训练使用、访问审计和删除策略 | 获得供应商条款或配置证明；关闭请求正文日志；明确区域、保留期和删除机制 | 人工 |
| P1 | 正式域名安全回归 | 当前主要在本地环境验证，反向代理后的 Origin、Host、TLS、HSTS 与 CSP 尚未实测 | 正式域名 HTTPS 扫描和真实 HTTP 回归通过，无跨域写入和混合内容 | 联合 |

`P0*` 说明：如果首发版本关闭购买入口，只提供人工发放或 CD-Key，支付项可以暂缓，但页面不得展示可用的购买承诺；一旦开放真实充值，该项立即升级为不可豁免的 P0。

### 推荐解除顺序

1. 分布式限流、账户额度和模型费用熔断。
2. Worker 原子领取、租约、幂等和中断恢复。
3. 密钥托管、Service Role 收缩和 Web/BFF 日志审计。
4. 云服务器网络隔离、正式域名 TLS 与安全头回归。
5. 备份恢复、监控告警和故障演练。
6. CI/CD、数据保留与海外隐私合规。
7. 开放购买入口前完成支付全链路。

## 11. 新增迁移与验收顺序

以下操作涉及生产数据库，必须由持有 Supabase 管理权限的人员执行：

1. 先执行 `infra/supabase/migrations/0020_worker_task_leases.sql`。
2. 发布新版 Worker；使用两个 Worker 同时轮询同一队列，确认同一任务只被一个实例领取。
3. 生成过程中强制停止领取者，等待租约到期后确认另一 Worker 接管，且不重复扣点、不覆盖已完成方案。
4. 执行 `infra/supabase/migrations/0021_generation_cost_circuit_breaker.sql`。
5. 先保持 `enforcement_enabled=false`，按真实预算设置四个阈值，再开启：

```sql
update public.generation_runtime_limits
set enforcement_enabled = true,
    max_global_active_jobs = 3,
    max_global_subjects_per_day = 300,
    max_global_subjects_per_month = 6000,
    max_user_subjects_per_day = 50,
    updated_at = now()
where singleton = true;
```

6. 分别触发用户日限额、全局并发、全局日限额和月限额，确认 API 只返回产品错误码，不泄漏数据库异常文本；关闭熔断后确认生成恢复。
7. 执行 `infra/supabase/migrations/0022_revision_storage_read_policy.sql`，用账户 A 验证自己的已发布调整版本可读取，再用账户 B 验证同一路径返回拒绝；列表、摘要和详情数据库读取已经使用 Session + RLS，Admin signer 不再承担业务数据查询。

阈值数字仅为安全默认示例，并非最终运营预算。未完成真实压测与费用换算前不得直接照搬到正式生产。

## 12. 受保护的 Readiness 检查

生产环境设置至少 24 个随机字符的独立 `HEALTHCHECK_TOKEN`。该值不得复用 Supabase、模型或支付密钥。监控系统调用：

```bash
curl --fail \
  -H "x-healthcheck-token: $HEALTHCHECK_TOKEN" \
  https://icons.example.com/api/health/ready
```

未设置 Token 时接口返回 `503`；Token 不匹配时返回 `404`；数据库不可达或三秒超时时返回不含内部异常的 `503`。
