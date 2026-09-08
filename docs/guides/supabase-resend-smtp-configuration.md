# EASY DESIGN / ICON GEN：Supabase + Resend SMTP 配置

用途：让 Gmail、Outlook、iCloud、QQ、163 及其他正常邮箱能够注册 EASY DESIGN / ICON GEN、接收验证邮件和密码重置邮件。

## 一、需要替换的内容

配置前准备：

- `YOUR_DOMAIN`：EASY DESIGN / ICON GEN 自有域名，例如 `easy-designicongen.com`。
- `YOUR_RESEND_API_KEY`：Resend 创建的 API Key，格式通常为 `re_...`。

建议使用独立认证邮件子域名：

```text
auth.YOUR_DOMAIN
```

建议发件地址：

```text
no-reply@auth.YOUR_DOMAIN
```

## 二、Resend 域名配置

在 Resend Dashboard 中进入 `Domains -> Add Domain`，添加：

```text
auth.YOUR_DOMAIN
```

然后在域名 DNS 后台逐条添加 Resend 页面生成的记录：

- SPF
- DKIM
- MX / Return-Path

不要手写或修改 Resend 给出的主机名、记录值、优先级。等待 Resend 域名状态变为 `Verified`。

建议按照 Resend 页面建议增加 DMARC。初始策略可使用监控模式：

```text
Type: TXT
Name: _dmarc.auth
Value: v=DMARC1; p=none;
```

如果 DNS 服务商会自动追加根域名，主机记录一般只填 `_dmarc.auth`；最终以 DNS 服务商界面规则为准。

## 三、创建 Resend API Key

在 Resend Dashboard 中进入 `API Keys -> Create API Key`：

```text
Name: easy-design-supabase-auth
Permission: Sending access
Domain: auth.YOUR_DOMAIN（如 Resend 支持限定域名）
```

复制生成的 `re_...` 密钥。该密钥只填写到 Supabase SMTP Password，不写入前端代码、不写入 `.env.local`、不提交 Git。

## 四、Supabase SMTP Settings

在 Supabase Dashboard 中进入：

```text
Authentication -> Emails -> SMTP Settings
```

开启：

```text
Enable custom SMTP: ON
```

填写以下配置：

```text
Sender name: EASY DESIGN / ICON GEN
Sender email: no-reply@auth.YOUR_DOMAIN
Host: smtp.resend.com
Port: 465
Username: resend
Password: YOUR_RESEND_API_KEY
```

端口 `465` 使用隐式 SSL/TLS。如果当前网络或平台对 465 有限制，可改为：

```text
Port: 587
```

端口 `587` 使用 STARTTLS。不要同时填写多个端口。

## 五、Supabase 邮箱注册配置

进入：

```text
Authentication -> Sign In / Providers -> Email
```

确认：

```text
Enable Email Provider: ON
Allow new users to sign up: ON
Confirm email: ON
```

## 六、Supabase URL Configuration

开发环境：

```text
Site URL: http://localhost:3000
```

Redirect URLs：

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
```

正式域名上线后增加：

```text
https://YOUR_DOMAIN/auth/callback
https://YOUR_DOMAIN/auth/reset-password
```

上线前将正式地址设为 Site URL，但保留 localhost Redirect URLs 供本地开发使用。

## 七、建议的认证邮件内容

主题保持简短，不添加营销语言或大量图片。

### 注册验证邮件主题

```text
Confirm your EASY DESIGN / ICON GEN account
```

### 密码重置邮件主题

```text
Reset your EASY DESIGN / ICON GEN password
```

邮件正文应保留 Supabase 模板提供的确认链接变量。不要把验证 URL 写成固定地址。

## 八、Rate Limits

进入：

```text
Authentication -> Rate Limits
```

早期建议从较低额度开始：

```text
Auth emails: 30 emails/hour
```

确认投递稳定并增加 CAPTCHA 后，再按实际注册量提高。不要为了测试无限提高发送额度。

## 九、验收邮箱

依次测试：

- Gmail
- Outlook
- iCloud
- QQ 邮箱
- 163 邮箱

每个邮箱检查：

1. 注册接口返回成功。
2. 能收到验证邮件。
3. 垃圾邮件箱中没有误判，或可以识别误判原因。
4. 验证链接返回 EASY DESIGN / ICON GEN。
5. 邮箱验证后能够登录。
6. `profiles` 自动生成。
7. `credit_accounts.balance` 为 `6`。
8. 密码重置邮件可以收到并完成修改。

## 十、安全要求

- Resend API Key 只保存在 Resend 与 Supabase Secret Settings 中。
- 不将 SMTP Password 写入任何 `NEXT_PUBLIC_` 环境变量。
- 不把密钥发到聊天、截图、文档或 GitHub。
- 泄漏后立即在 Resend 撤销旧 Key，并生成新 Key。
- 注册页正式开放前增加 CAPTCHA、IP 限流和失败日志。
