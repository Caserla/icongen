# 登录与账户 API 前端调用手册

文档版本：1.0  
对应规范：[`auth-account.openapi.yaml`](./auth-account.openapi.yaml)  
本地地址：`http://localhost:3000`

## 1. 接入原则

- 前端只调用 EASY DESIGN / ICON GEN 同域 `/api/*` 接口，不直接管理 Supabase Session。
- 登录状态通过 Supabase SSR 的 HttpOnly Cookie 保存。
- 浏览器不得读取、拼接或保存认证 Cookie。
- 同域 `fetch` 默认携带 Cookie；若前后端以后分域，必须重新设计 CORS、Cookie 和 CSRF 策略。
- 所有写接口使用 `Content-Type: application/json`。
- `error` 是前端判断逻辑使用的稳定错误码，`message` 是英文兜底文案。
- 不要直接向用户展示 Supabase 原始错误。

## 2. 通用请求封装

```ts
export type ApiErrorBody = {
  error: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    const error = body as ApiErrorBody;
    throw new ApiError(response.status, error.error, error.message, error.details);
  }
  return body as T;
}
```

## 3. 推荐前端类型

```ts

export type AccountSummary = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  creditBalance: number;
  status: AccountStatus;
  createdAt: string;
};
```

项目中也可以直接从 `@icongen/shared` 引入 `AccountSummary` 和表单 Schema。

## 4. 注册流程

### 请求

```ts
const result = await apiRequest<{
  requiresEmailVerification: boolean;
  next: string;
}>("/api/auth/sign-up", {
  method: "POST",
  body: JSON.stringify({
    email,
    password,
    acceptedTerms: true,
    next: "/create",
  }),
});
```

### 前端处理

1. `201` 且 `requiresEmailVerification=true`：在注册页进入“检查邮箱”状态；用户点击邮件链接后由 `/auth/callback` 建立会话并进入 `/auth/verified`。
2. 保存邮箱只用于验证页展示和重发，不保存密码。
3. `VALIDATION_ERROR`：展示字段错误。
4. `SIGN_UP_FAILED`：展示通用注册失败提示。

## 5. 邮箱验证流程

验证邮件会打开：

```text
/auth/callback?code=...&next=/create
```

该路由由后端处理并自动跳转，前端不需要读取 `code`。

回调失败会跳转：

```text
/auth/sign-in?error=invalid_callback
```

登录页应根据该参数显示“链接无效或已过期”的提示。

### 重发验证邮件

```ts
await apiRequest<{ message: string }>("/api/auth/resend-verification", {
  method: "POST",
  body: JSON.stringify({ email }),
});
```

无论邮箱是否存在，接口都返回通用成功信息，前端不得据此判断账户是否存在。

## 6. 登录流程

```ts
const result = await apiRequest<{ userId: string; next: string }>("/api/auth/sign-in", {
  method: "POST",
  body: JSON.stringify({ email, password, next: "/create" }),
});

window.location.assign(result.next);
```

错误处理：

| HTTP | 错误码 | 前端行为 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 展示字段错误 |
| 401 | `INVALID_CREDENTIALS` | 显示统一的邮箱或密码错误 |
| 403 | `EMAIL_NOT_VERIFIED` | 进入验证邮箱页面 |

`next` 已由后端过滤为站内路径，但前端仍应直接使用响应中的 `next`，不要使用未经验证的 URL 查询参数。

## 7. 退出流程

```ts
await apiRequest<void>("/api/auth/sign-out", { method: "POST" });
window.location.assign("/");
```

成功响应为 `204 No Content`。

## 8. 忘记与重置密码

### 申请恢复邮件

```ts
await apiRequest<{ message: string }>("/api/auth/forgot-password", {
  method: "POST",
  body: JSON.stringify({ email }),
});
```

前端始终展示通用提示，不能提示邮箱是否存在。

### 恢复回调

恢复邮件必须使用 `token_hash + type=recovery`，经过 `/auth/callback`
验证 OTP 并建立临时恢复会话，然后强制跳转：

```text
https://esdesign.men/auth/callback?token_hash={{ .TokenHash }}&type=recovery
```

Supabase Dashboard 的 **Authentication → Email Templates → Reset Password**
模板按钮链接配置为：

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

不要使用只携带 `code` 的 PKCE 恢复链接作为正式模板；它依赖发起请求浏览器中的
code verifier，在邮件 App、另一浏览器或另一设备打开时会失败。代码回调仅作为旧邮件兼容路径保留。

```text
/auth/reset-password
```

无效或过期的恢复链接返回 `/auth/forgot-password?error=invalid_recovery_link`，
页面显示明确提示并允许重新发送，不再回到普通登录页。

### 设置新密码

```ts
await apiRequest<{ updated: true }>("/api/auth/reset-password", {
  method: "POST",
  body: JSON.stringify({ password: newPassword }),
});
```

错误：

- `VALIDATION_ERROR`：密码少于 8 个字符或超过 128 个字符。
- `RECOVERY_SESSION_REQUIRED`：恢复链接无效、过期或没有先经过回调。
- `PASSWORD_RESET_FAILED`：供应商拒绝更新，展示通用错误。

## 9. 获取账户信息

```ts
const account = await apiRequest<AccountSummary>("/api/account");
```

响应示例：

```json
{
  "id": "a9f16054-b667-4e62-aa21-1e67dad677af",
  "email": "user@example.com",
  "emailVerified": true,
  "displayName": "Alex",
  "creditBalance": 20,
  "status": "active",
  "createdAt": "2026-08-19T10:00:00.000Z"
}
```

状态处理：

- `active`：正常展示全部账户功能。
- `restricted`：显示限制说明，隐藏生成和付款操作。

## 10. 修改昵称

```ts
const profile = await apiRequest<{
  displayName: string | null;
  updatedAt: string;
}>("/api/account/profile", {
  method: "PATCH",
  body: JSON.stringify({ displayName: "Alex" }),
});
```

传入 `null` 可以清除昵称。非空昵称去除首尾空格后长度必须为 1–40 个字符。

该接口不能修改邮箱、点数余额或账户状态。


前端必须先展示影响说明，并要求用户：

1. 输入大写 `DELETE`。
2. 输入当前密码进行重新认证。
3. 确认不存在仍需保留的作品或点数。

```ts
const result = await apiRequest<{
  requestId: string;
  method: "POST",
  body: JSON.stringify({
    confirmation: "DELETE",
    password: currentPassword,
    idempotencyKey: crypto.randomUUID(),
  }),
});
```

同一次用户操作重试时必须复用同一个 `idempotencyKey`。

| HTTP | 错误码 | 前端行为 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | 检查确认文字、密码和幂等键 |
| 401 | `AUTH_REQUIRED` | 跳转登录页 |
| 401 | `REAUTH_REQUIRED` | 提示当前密码验证失败 |
| 409 | `ACTIVE_GENERATION_EXISTS` | 提示等待生成任务结束 |


## 12. 全局认证错误处理

建议在 API Client 层统一处理：

```ts
try {
  await loadProtectedData();
} catch (error) {
  if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  }
  throw error;
}
```

常用错误码：

| 错误码 | 含义 |
| --- | --- |
| `VALIDATION_ERROR` | 请求字段不符合要求 |
| `AUTH_REQUIRED` | 没有有效登录会话 |
| `EMAIL_NOT_VERIFIED` | 邮箱尚未验证 |
| `ACCOUNT_RESTRICTED` | 账户不是 active 状态 |
| `INVALID_CREDENTIALS` | 登录凭据错误 |
| `REAUTH_REQUIRED` | 高风险操作重新认证失败 |
| `ACCOUNT_LOAD_FAILED` | 账户信息读取失败 |
| `PROFILE_UPDATE_FAILED` | 昵称更新失败 |

## 13. 页面与接口对应关系

| 前端页面 | 使用接口 |
| --- | --- |
| `/auth/sign-up` | `POST /api/auth/sign-up` |
| `/auth/sign-up` 的检查邮箱状态 | `POST /api/auth/resend-verification` |
| `/auth/verified` | 验证成功展示、保留登录态并安全跳转，无额外业务 API |
| `/auth/sign-in` | `POST /api/auth/sign-in` |
| `/auth/forgot-password` | `POST /api/auth/forgot-password` |
| `/auth/reset-password` | `POST /api/auth/reset-password` |
| App Shell 退出按钮 | `POST /api/auth/sign-out` |
| `/account` | `GET /api/account`、`PATCH /api/account/profile` |

## 14. 前端联调前置条件

后端环境必须配置：

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Supabase 数据库必须按顺序执行：

```text
0001_initial_schema.sql
0002_configurable_generation_runtime.sql
0003_user_auth_and_account.sql
```

Supabase Auth 控制台还需要配置本地及生产 Site URL、允许的回调 URL，并启用邮箱密码登录。

## 15. 当前接口边界

- 接口已经实现并通过类型检查、单元测试和生产构建。
- 邮件限流仍依赖 Supabase 配置及后续应用层限流。
- 真实邮件和认证流程必须连接实际 Supabase 测试项目后进行集成测试。
