# 用户信息、登录与账户开发任务

关联需求：[用户信息、登录与账户模块需求](../product/user-auth-account-requirements.md)

## 1. 迭代顺序

建议拆成 5 个可独立验收的开发阶段：

1. Supabase Auth 基础与服务端会话。
2. 注册、验证、登录、退出。
3. 密码恢复与受保护路由。
4. 账户资料与余额摘要。
5. 账户状态与删除申请。

## 2. 基础与数据库任务

- [ ] `AUTH-DATA-01` 创建 Supabase 本地/测试/生产环境配置说明。
- [x] `AUTH-DATA-02` 新增账户状态与删除申请数据库迁移。
- [x] `AUTH-DATA-03` 为 `profiles.updated_at` 增加自动更新时间触发器。
- [ ] `AUTH-DATA-04` 检查新用户触发器可以幂等创建 `profiles` 和 `credit_accounts`。
- [x] `AUTH-DATA-05` 完善 Profiles、余额账户和删除申请 RLS。
- [ ] `AUTH-DATA-06` 增加新用户体验点数的服务端配置，默认 0。
- [x] `AUTH-DATA-07` 增加 Auth 和账户相关共享 Zod Schema、DTO 和错误码。
- [ ] `AUTH-DATA-08` 建立测试用户与数据库回滚方案。

完成条件：迁移可在空数据库执行，也可在已有 `0001`、`0002` 的环境升级；RLS 测试证明跨用户访问失败。

## 3. 后端开发任务

### 3.1 Supabase 客户端与会话

- [x] `AUTH-BE-01` 安装并配置 Supabase SSR 支持。
- [ ] `AUTH-BE-02` 建立浏览器 Supabase Client 工厂。
- [x] `AUTH-BE-03` 建立服务端 Supabase Client 工厂。
- [x] `AUTH-BE-04` 建立仅服务端可用的 Admin Client，并隔离 Service Role Key。
- [x] `AUTH-BE-05` 实现 Cookie 会话读取、刷新和清理。
- [x] `AUTH-BE-06` 实现安全的站内 `next` 跳转校验函数。

### 3.2 Auth 流程

- [x] `AUTH-BE-07` 实现邮箱密码注册 Server Action 或 Route Handler。
- [x] `AUTH-BE-08` 实现登录 Server Action 或 Route Handler。
- [x] `AUTH-BE-09` 实现 `/auth/callback`，处理验证和密码恢复回调。
- [ ] `AUTH-BE-10` 实现验证邮件重发并增加限流（重发接口已实现，限流待接入）。
- [x] `AUTH-BE-11` 实现忘记密码请求。
- [x] `AUTH-BE-12` 实现设置新密码。
- [x] `AUTH-BE-13` 实现退出登录并清理会话。
- [ ] `AUTH-BE-14` 配置 Supabase Site URL、Redirect URL 和英文邮件模板。

### 3.3 鉴权与账户 API

- [x] `AUTH-BE-15` 建立 `requireUser`、`requireVerifiedUser` 和账户状态守卫。
- [ ] `AUTH-BE-16` 为 `/create`、`/icons`、`/account` 页面增加服务端保护。
- [x] `AUTH-BE-17` 为生成、支付和账户 API 增加服务端鉴权。
- [x] `USER-BE-01` 实现 `GET /api/account`。
- [x] `USER-BE-02` 实现 `PATCH /api/account/profile`。
- [x] `USER-BE-03` 确保资料接口不可修改邮箱、余额和账户状态。
- [x] `USER-BE-04` 实现 `POST /api/account/delete-request` 的重新认证和幂等校验。
- [x] `USER-BE-05` 删除请求前检查 queued/processing 生成任务。
- [ ] `USER-BE-06` 实现删除申请异步处理入口或管理后台处理接口。
- [x] `USER-BE-07` 为账户限制和删除操作写审计日志。
- [ ] `USER-BE-08` 对认证和高风险接口增加限流。

完成条件：API 使用统一错误码；所有鉴权以服务端会话和数据库权限为准，不信任客户端 userId 或余额。

## 4. 前端开发任务

### 4.1 登录与注册

- [ ] `AUTH-FE-01` 把 `/auth/sign-in` 占位页改为可用登录表单。
- [ ] `AUTH-FE-02` 新增 `/auth/sign-up` 注册页面。
- [ ] `AUTH-FE-03` 新增密码可见性切换、浏览器自动填充属性和字段校验。
- [ ] `AUTH-FE-04` 新增条款与隐私政策确认控件。
- [ ] `AUTH-FE-05` 新增 `/auth/verify-email` 页面和重发按钮。
- [ ] `AUTH-FE-06` 实现登录后安全返回原目标路径。
- [ ] `AUTH-FE-07` 实现提交中、成功、字段错误、限流和网络错误状态。

### 4.2 密码恢复

- [ ] `AUTH-FE-08` 新增 `/auth/forgot-password` 页面。
- [ ] `AUTH-FE-09` 新增 `/auth/reset-password` 页面。
- [ ] `AUTH-FE-10` 增加链接过期、密码不符合规则和重置成功状态。

### 4.3 会话与导航

- [ ] `AUTH-FE-11` Marketing Header 根据会话显示 Sign in 或 Dashboard。
- [ ] `AUTH-FE-12` App Shell 显示账户入口、点数摘要和退出菜单。
- [ ] `AUTH-FE-13` 增加会话加载与过期后的统一交互。
- [ ] `AUTH-FE-14` 保证受保护页面跳转没有闪现用户数据。

### 4.4 账户中心

- [ ] `USER-FE-01` 把 `/account` 占位页改为真实账户摘要页。
- [ ] `USER-FE-02` 展示邮箱、验证状态、昵称、余额、创建时间和账户状态。
- [ ] `USER-FE-03` 实现昵称编辑、保存、取消和反馈。
- [ ] `USER-FE-04` 增加账户数据 Skeleton、错误和重试状态。
- [ ] `USER-FE-05` 增加退出登录入口。
- [ ] `USER-FE-06` 新增 Danger Zone 和删除账户入口。
- [ ] `USER-FE-07` 新增删除影响说明、输入 `DELETE` 和二次确认。
- [ ] `USER-FE-08` 展示进行中任务阻止删除、重新认证和删除待处理状态。

完成条件：所有页面英文优先、响应式、键盘可操作，并提供明确 Label、错误关联和焦点反馈。

## 5. 测试任务

### 单元与集成测试

- [x] `AUTH-TEST-01` 邮箱、密码、昵称和删除确认 Schema 测试。
- [x] `AUTH-TEST-02` 安全跳转校验测试，覆盖外部 URL 和协议绕过。
- [ ] `AUTH-TEST-03` Auth 错误到稳定业务错误码的映射测试。
- [ ] `AUTH-TEST-04` 账户 API 未登录、未验证、受限制和正常状态测试。
- [ ] `AUTH-TEST-05` RLS 跨用户读取和写入拒绝测试。
- [ ] `AUTH-TEST-06` 删除请求幂等与进行中任务冲突测试。

### 端到端测试

- [ ] `AUTH-E2E-01` 注册 → 邮箱验证 → 登录 → 创建页。
- [ ] `AUTH-E2E-02` 登录失败和限流提示。
- [ ] `AUTH-E2E-03` 未登录访问受保护页 → 登录 → 返回原页面。
- [ ] `AUTH-E2E-04` 忘记密码 → 重置 → 新密码登录。
- [ ] `AUTH-E2E-05` 修改昵称并刷新后保持。
- [ ] `AUTH-E2E-06` 退出后无法访问账户数据。
- [ ] `AUTH-E2E-07` 删除账户重新认证、二次确认和冲突处理。

### 质量检查

- [ ] `AUTH-QA-01` `npm run typecheck` 通过。
- [ ] `AUTH-QA-02` `npm test` 通过。
- [ ] `AUTH-QA-03` `npm run build` 通过。
- [ ] `AUTH-QA-04` 检查前端构建产物不包含 Service Role Key。
- [ ] `AUTH-QA-05` 移动端、桌面端、键盘和基础无障碍检查通过。

## 6. 运维与上线任务

- [ ] `AUTH-OPS-01` 配置生产 Supabase Site URL 和 Redirect URLs。
- [ ] `AUTH-OPS-02` 配置发件域名、英文验证邮件和密码恢复邮件。
- [ ] `AUTH-OPS-03` 在 Vercel 配置 Supabase 公共变量和服务端密钥。
- [ ] `AUTH-OPS-04` 设置 Auth 速率限制和异常告警。
- [ ] `AUTH-OPS-05` 接入认证漏斗和账户操作埋点。
- [ ] `AUTH-OPS-06` 编写账户恢复、限制和删除异常的运维手册。
- [ ] `AUTH-OPS-07` 上线前确认隐私政策、数据保留及删除规则。

## 7. 依赖与阻塞项

- 新用户赠送点数数量依赖点数与 Stripe 模块，当前默认 0。
- 删除后的订单、账本、作品和审计数据策略需要上线前确认。
- 隐私政策、服务条款 URL 和支持邮箱需要上线前提供。
- 邮件发件域名和品牌文案依赖品牌设计。

这些阻塞项不影响先完成注册、登录、会话、账户摘要和昵称修改等 P0 功能。

## 8. 推荐首个开发 Sprint

首个 Sprint 建议完成：

- `AUTH-DATA-01` 至 `AUTH-DATA-05`
- `AUTH-BE-01` 至 `AUTH-BE-09`
- `AUTH-BE-15` 至 `AUTH-BE-17`
- `AUTH-FE-01` 至 `AUTH-FE-07`
- `AUTH-FE-11` 至 `AUTH-FE-14`
- 对应的 Schema、鉴权和 E2E 测试

Sprint 验收结果：用户可以注册、验证邮箱、登录、保持会话、退出，并被正确引导进出受保护页面。
