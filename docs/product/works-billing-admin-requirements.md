# 作品、支付与运营业务模块需求

文档版本：2.0
产品阶段：MVP

本文细化六个业务模块中的“作品与下载”“点数与 Stripe 支付”“最小运营支持”。图片生成的表单、进度和结果网格见 [图片生成模块需求](./icon-generation-requirements.md)。

## 1. 作品与下载模块

### 1.1 模块目标

让用户在离开生成页后仍能找到批量任务，查看每个主体的 3 个方案、恢复选择、下载选中 PNG，并以相同设计参数再次创建。

### WORK-001 我的图标列表 `/icons` — P0

列表以“生成任务”而不是单张图片为单位。每张任务卡展示：

- 任务名称或首个主体名称与“等 N 项”。
- 主体数量、计划方案数与成功方案数。
- 最多 4 张结果缩略图。
- `queued / processing / completed / partial / failed` 状态。
- 进度、创建时间、点数摘要和背景模式。
- 查看结果、再次生成入口。

支持状态筛选、关键词搜索、创建时间排序和分页。首次无作品显示创建 CTA；筛选无结果应区分于账户无作品。

验收标准：刷新后状态准确；同一用户只能看到自己的任务；100 条以上任务采用游标分页而非一次加载。

### WORK-002 任务详情与选择恢复 `/icons/[jobId]` — P0

- 复用图片生成模块的阶段二页面。
- 显示提交时的主体、颜色、背景、10 维度选择、尺寸和版本摘要。
- 选择状态保存在当前结果页，用于批量 ZIP 下载。
- 用户可复制当前任务为新草稿；复制使用当前仍有效的核心设置映射，失效选项需重新确认。
- 已删除或过期资产显示明确状态，不展示损坏图片。

### WORK-004 ZIP 归档 — P0

请求体只接受当前任务的 `resultIds` 和允许尺寸；服务端去重并验证。归档异步超过 2 秒时返回 archive ID，前端显示进度并查询状态。

ZIP 包含：

- 按主体目录组织的 PNG。
- `manifest.json`：主体、variant、尺寸、颜色/背景、核心设置/Skill/模型版本和生成时间。
- 不包含 API Key、内部完整 Prompt、用户邮箱或账单信息。

### WORK-005 删除与保留 — P0

用户作品自生成完成起保留 30 天。历史列表和任务详情必须显示到期时间；到期后删除母版、派生 PNG、预览文件和关联下载归档，保留必要的脱敏任务与财务引用。

用户提交删除账户后进入 30 天宽限期，可通过账户删除状态页创建“下载我的数据”归档。归档包含用户资料、订单、点数账本、账单摘要，以及请求时仍未过期的作品资产与清单；已过期作品不能恢复。数据导出 ZIP 保存 24 小时，过期后可在账户宽限期内重新申请。

用户主动删除单个任务时，MVP 可先隐藏展示并等待统一清理；订单、账本和审计不随作品直接删除，其保留与匿名化规则另行确认。

### 1.2 API 与异常

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/generation/jobs` | 筛选和分页查询自己的任务 |
| `GET` | `/api/generation/jobs/{jobId}` | 查询详情、进度和结果 |
| `POST` | `/api/generation/jobs/{jobId}/downloads` | 创建选中结果 ZIP |
| `DELETE` | `/api/generation/jobs/{jobId}` | P1 删除作品记录 |
| `POST` | `/api/account/data-export` | 删除宽限期内创建用户资产归档 |
| `GET` | `/api/account/data-export/{exportId}` | 查询导出状态和短时下载链接 |

核心错误：`AUTH_REQUIRED`、`RESOURCE_FORBIDDEN`、`RESULT_NOT_READY`、`NO_RESULTS_SELECTED`、`ARCHIVE_FAILED`、`ASSET_EXPIRED`。

### 1.3 指标与完成定义

指标：历史页回访率、详情打开率、方案选择率、首选标记率、单图/ZIP 下载成功率、再次生成率。

完成定义：列表、详情、选择、单图和 ZIP 下载均接入真实私有资源；刷新与跨设备状态符合规则；越权测试通过。

## 2. 点数与 Stripe 支付模块

### 2.1 模块目标

使用预付点数包建立简单、可追溯的海外付款闭环。Stripe Webhook 是付款入账唯一可信来源，前端返回参数不能直接增加点数。

### BILL-001 点数包与价格 `/pricing` — P0

首发测试点数包：

| 点数包 | USD 价格 | 点数 | 可生成主体数 | 定位 |
| --- | ---: | ---: | ---: | --- |
| Starter | `$2.99` | 30 | 30 | 轻量试用 |
| Maker | `$6.49` | 75 | 75 | 默认推荐 |
| Studio | `$12.99` | 180 | 180 | 批量生产 |

页面展示 USD 价格、点数、推荐标记和按当前价格版本估算的“可生成图标主体数”。每个主体固定包含 3 个方案，整体消耗 1 点，不按单个方案拆分收费。

点数包字段：`id`、中英文名称、Stripe Price ID、价格、币种、点数、排序、启用状态和价格版本。停用套餐不能新建 Checkout，但历史订单仍可查询。

### BILL-001A 新用户体验点数 — P0

- 新用户获得一次 6 点体验点数，可生成 6 个主体、共 18 个方案。
- 新用户赠送点数永久有效，MVP 不设置领取后到期时间。
- 体验点数不经过 Stripe，不建立支付订单，但必须写入不可变账本，类型为 `signup_bonus`。
- 发放必须与账户初始化事务一致并使用稳定业务键保证幂等。
- 后台可查询发放记录和执行失败补偿，但不能再次手工触发同一业务键。

### BILL-002 生成前报价与扣点 — P0

- 创建页根据服务端配置显示预计消耗。
- 服务端以 `主体数量 × 1 点` 和价格版本计算最终消耗；3 个方案是每主体的固定交付组成，不允许前端篡改方案数降低价格。
- 提交时余额锁定、扣点、任务和账本在同一事务完成。
- 余额不足返回所需点数、当前余额和购买入口，设计草稿不得丢失。
- 系统为同一主体自动重试或补齐缺失方案不额外收费。
- 一个主体最终未完整交付 3 个方案时，整笔返还该主体的 1 点；可用的部分结果仍允许用户查看和下载。
- 用户主动重新生成一组新的 3 个方案消耗 1 点；MVP 不提供按单个方案付费生成。
- 自动重试、扣点和返还均需要幂等业务键，不能因队列重复消费重复记账。
- 购买点数和新用户赠送点数均永久有效；MVP 不实现点数到期、过期回收或按有效期排序扣点。

### BILL-002A 促销与优惠 — P1

- MVP 不向用户开放促销码输入框。
- Stripe Checkout 集成保留 `allow_promotion_codes` 或指定 Coupon 的扩展边界，但生产默认关闭。
- 首发活动优先使用额外赠点，账本类型为 `promotion_bonus`，不直接修改已发布点数包价格。
- 促销赠点可以配置有效期；购买点数默认不失效。
- 后台赠点必须记录活动 ID、原因、操作人和幂等键。

### BILL-003 Stripe Checkout — P0

1. 登录且已验证用户选择点数包。
2. 前端提交 `packageId` 和幂等键。
3. 服务端先创建内部待支付订单并生成业务订单号，再从版本化套餐读取 Stripe Price ID 创建 Checkout Session。
4. 浏览器跳转 Stripe 托管页面。
5. Stripe 返回 `/billing/result?session_id=...`。
6. 返回页轮询服务端订单状态；只在签名 Webhook 完成后刷新余额。

同一个支付 Session 或 Event ID 只能入账一次。

#### 内部订单与业务订单号

- 数据库 UUID `id` 是内部主键；另外由后端生成唯一、不可预测且适合客服沟通的 `order_number`，格式为 `ICO-YYYYMMDD-XXXXXXXXXX`。前端和导出文件展示业务订单号，不自行拼接或生成。
- `order_number` 使用安全随机字符并建立唯一索引；发生极低概率冲突时由后端重试。不得使用连续自增号码暴露订单量。
- 创建订单必须以 `(user_id, idempotency_key)` 唯一约束保证幂等。重复请求返回原订单和原 Checkout Session，不得新增订单或重复收费。
- 下单时固化套餐 ID、套餐名称、价格版本、Stripe Price ID、币种、最小货币单位金额和点数；之后套餐改价不得改变历史订单。
- Stripe Checkout Session 的 metadata 同时写入内部订单 UUID 和业务订单号；Webhook 仍以数据库 UUID 定位并加行锁处理。
- 订单状态至少支持 `pending / paid / canceled / expired / failed / refunded`；只有通过签名验证的 Webhook 能把订单改为 `paid` 并增加点数。
- Checkout 创建失败时保留可追踪的失败订单和错误码，不保存敏感错误正文；安全重试使用同一个幂等键。
- `orders.csv` 使用业务订单号作为主要展示标识，同时保留内部 UUID 和可公开的 Stripe Session/PaymentIntent 引用。

#### 账单摘要生成规则

- `billing-summary.json` 在导出时从订单和不可变点数账本计算，不作为余额或财务入账的权威数据源。
- 摘要包含统计起止时间、成功购买总额、退款总额、净支付额、购买点数、体验/促销赠点、生成消耗、失败返还、人工调整和当前余额。
- 所有金额使用整数最小货币单位并携带币种；首发只有 USD。若未来出现多币种，不允许直接跨币种相加。

### BILL-004 支付结果 `/billing/result` — P0

状态：确认中、成功、取消、失败、入账延迟。成功展示购买点数、新余额和返回创建页；入账延迟提供刷新但不重复创建订单。

### BILL-005 点数账本 `/account/credits` — P1

展示购买、生成扣点、失败/部分失败返还和管理员调整。每条包括类型、点数变化、余额快照、关联任务/订单、时间和状态。用户只读。

### BILL-006 退款与争议 — P1

Stripe 退款或争议由 Webhook 更新订单，并按运营规则调整尚未消费点数；不足时进入人工处理，不制造未经审计的负余额。

### 2.2 API、数据与异常

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/billing/packages` | 获取启用点数包与价格版本 |
| `POST` | `/api/billing/quote` | 根据主体数量返回报价 |
| `POST` | `/api/billing/checkout` | 创建 Checkout Session |
| `GET` | `/api/billing/orders/{orderNumber}` | 使用本人业务订单号查询支付与入账状态 |
| `POST` | `/api/webhooks/stripe` | 验签、去重并入账 |
| `GET` | `/api/account/credits` | 分页查询账本 |

数据：`credit_packages`、`orders`、`stripe_events`、`credit_accounts`、不可变 `credit_ledger`、`pricing_versions` 和体验赠送配置版本。现有骨架中的 `orders` 作为规范表名，后续迁移不得再另建语义重复的 `billing_orders`。

错误：`PACKAGE_UNAVAILABLE`、`PRICE_VERSION_CHANGED`、`CHECKOUT_CREATE_FAILED`、`PAYMENT_PENDING`、`WEBHOOK_SIGNATURE_INVALID`、`EVENT_ALREADY_PROCESSED`。

### 2.3 指标与完成定义

指标：价格页到 Checkout 转化、各点数包占比、每主体收入与模型成本、毛利率、支付成功率、Stripe 手续费占比、Webhook P95 入账时延、重复事件数、余额异常数、失败返还时延。

完成定义：测试与生产环境配置分离；签名和幂等测试通过；任何浏览器请求都不能直接修改余额；生成报价、扣点和返还能够按价格版本追踪。

## 3. 最小运营支持模块

### 3.1 模块目标

本项目不建设完整运营后台。只提供处理首版用户问题所必需的受保护工具，集中在 `/admin/operations`。

### OPS-001 管理员保护 — P0

- 普通用户访问运营页面或 API 必须得到 403。
- 首版只区分管理员与普通用户，不建设多层 RBAC。
- 写操作必须填写原因、使用幂等键并写入不可变审计记录。
- 页面和 API 不得返回 API Key、Stripe Secret、Supabase Service Role 或完整内部 Prompt。

### OPS-002 任务查询与安全重试 — P0

- 通过 job ID 或用户邮箱查询生成任务、主体、3 个 variant、进度、错误码和扣点/返还摘要。
- 只允许重试未成功的工作单元，不重复生成成功 variant，也不重复扣点。
- 不提供数据看板、复杂筛选、模型成本分析、灰度发布或设置管理。

### OPS-003 订单、Webhook 与人工调点 — P0

- 通过订单 ID、Stripe Session ID 或 Event ID 查询支付和入账状态。
- 人工调点必须填写原因和外部工单号，不允许修改历史账本。
- 不提供自动退款、争议工作台或完整用户管理。

### 3.2 API 与完成定义

最小 API：`GET /api/admin/operations/jobs/{jobId}`、`POST /api/admin/operations/variants/{variantId}/retry`、`GET /api/admin/operations/billing/search`、`POST /api/admin/operations/credits/adjust`、`GET /api/admin/operations/audit`。

完成定义：管理员可以定位生成或支付问题、进行安全重试和受审计调点；普通用户不能访问；密钥和完整内部 Prompt 不会泄露。
