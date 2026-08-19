# IconGen AI 模型与 Skill 配置说明书

文档版本：1.0  
适用项目：IconGen  
适用对象：IconGen 平台开发者、部署人员和管理员

## 1. 文档目的

本文说明如何为 IconGen 配置图片生成模型、API Key 和 Icon Skill。

这些配置由 IconGen 平台提供方统一管理，不开放给网站普通用户。用户只能提交 App 产品描述和选择允许的图标风格，不能指定模型、供应商、API Key 或内部 Skill。

## 2. 配置关系

```text
普通用户
  → 提交 App 描述和风格
  → IconGen 后端生成任务
  → Worker 读取平台部署配置
  → 调用已启用的 Icon Skill
  → 调用已启用的 AI 图片模型
  → 保存并返回 4 个 PNG 方案
```

平台方控制以下配置：

| 配置项 | 示例 | 说明 |
| --- | --- | --- |
| `IMAGE_PROVIDER` | `openai` | 图片模型供应商 |
| `IMAGE_MODEL` | `gpt-image-2` | 使用的图片模型 |
| `IMAGE_PROVIDER_API_KEY` | `sk-...` | 平台方持有的服务端 API Key |
| `ICON_SKILL` | `default-icon` | 当前启用的 Icon Skill |

## 3. 申请 OpenAI API Key

1. 登录 [OpenAI Platform](https://platform.openai.com/)。
2. 打开 [API Keys](https://platform.openai.com/api-keys)。
3. 创建新的 Secret Key。
4. 配置 API 账单、使用额度和必要的项目权限。
5. 立即复制并安全保存生成的 Key。

OpenAI 图片生成接口使用方式参考 [OpenAI Image API 官方文档](https://developers.openai.com/api/docs/guides/image-generation)。

注意：

- API Key 通常不会在创建后再次完整显示。
- 不得把 API Key 写入前端代码。
- 不得把真实 Key 提交到 GitHub。
- 不得通过聊天、截图或公开文档传递生产 Key。

## 4. 本地开发配置

### 4.1 配置文件位置

模板文件：

```text
services/icon-worker/.env.example
```

在本地复制为：

```text
services/icon-worker/.env
```

### 4.2 配置内容

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
IMAGE_PROVIDER_API_KEY=填写平台方的OpenAI密钥

ICON_SKILL=default-icon

SUPABASE_URL=填写Supabase项目地址
SUPABASE_SERVICE_ROLE_KEY=填写Supabase服务端密钥
SUPABASE_ICON_BUCKET=generated-icons

GENERATION_MAX_ATTEMPTS=3
```

### 4.3 字段说明

- `IMAGE_PROVIDER`：供应商注册名称。当前内置值为 `openai`。
- `IMAGE_MODEL`：供应商提供的实际图片模型名称。
- `IMAGE_PROVIDER_API_KEY`：平台方的服务端模型密钥。
- `ICON_SKILL`：Skill 注册名称。当前内置值为 `default-icon`。
- `SUPABASE_URL`：Supabase 项目 URL。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase Service Role Key，只能在服务端使用。
- `SUPABASE_ICON_BUCKET`：生成结果存储桶，默认是 `generated-icons`。
- `GENERATION_MAX_ATTEMPTS`：任务最大处理次数，默认是 3。

## 5. AWS 正式环境配置

### 5.1 部署模板

AWS SAM 模板位于：

```text
infra/aws/template.yaml
```

### 5.2 部署命令

```bash
sam build --template-file infra/aws/template.yaml
sam deploy --guided
```

### 5.3 部署参数

部署过程中填写：

```text
ImageProvider: openai
ImageModel: gpt-image-2
ImageProviderApiKey: 平台方的OpenAI API Key
IconSkill: default-icon
SupabaseUrl: Supabase项目地址
SupabaseServiceRoleKey: Supabase服务端密钥
ReservedConcurrency: 5
```

部署完成后，Lambda Worker 会读取这些服务端环境变量。网站用户无法看到或修改这些配置。

生产环境建议把模型 API Key 和 Supabase Service Role Key 存储在 AWS Secrets Manager，并通过动态引用提供给 Lambda。

## 6. 默认 Icon Skill

### 6.1 文件位置

默认 Skill 位于：

```text
packages/icon-skill/src/index.ts
```

Skill 包含：

- Skill 名称和版本。
- 4 个图标方案的差异化设计方向。
- 产品描述到图片提示词的编译逻辑。
- 禁止文字、水印、现有品牌和受版权保护角色等约束。
- 单个正方形 App Icon 的输出要求。

### 6.2 名称和版本

```ts
export const ICON_SKILL_NAME = "default-icon";
export const ICON_SKILL_VERSION = "0.1.0";
```

修改提示词规则后应升级版本。例如：

```ts
export const ICON_SKILL_VERSION = "0.2.0";
```

数据库会记录任务实际使用的供应商、模型、Skill 名称和 Skill 版本，方便追踪历史结果。

### 6.3 Skill 的含义

当前 Icon Skill 是 IconGen 后端中的 TypeScript 业务模块，不是安装在 ChatGPT 或 Codex 中的 `SKILL.md`。它会随 Lambda Worker 一起构建和部署。

## 7. 修改默认 Skill

如果只需要调整默认提示词，可以直接修改：

```text
packages/icon-skill/src/index.ts
```

建议步骤：

1. 修改四个 `directions` 生成方向。
2. 调整通用提示词和负向约束。
3. 升级 `ICON_SKILL_VERSION`。
4. 运行类型检查和测试。
5. 重新部署 Lambda Worker。

验证命令：

```bash
npm run typecheck
npm test
```

## 8. 增加新的 Skill

如果需要保留默认 Skill，同时增加另一套 Skill，可以新建独立包或 Worker 适配器。

推荐目录：

```text
packages/
  icon-skill/
  premium-icon-skill/
```

新的 Skill 必须实现 `PromptCompiler`：

```ts
interface PromptCompiler {
  readonly name: string;
  readonly version: string;
  compile(input: {
    description: string;
    stylePreset?: string;
    slot: 1 | 2 | 3 | 4;
  }): {
    prompt: string;
    skillVersion: string;
  };
}
```

然后在以下文件注册：

```text
services/icon-worker/src/registries.ts
```

示例：

```ts
const promptCompilerRegistry = {
  "default-icon": defaultIconSkill,
  "premium-icon": premiumIconSkill,
};
```

部署配置切换为：

```env
ICON_SKILL=premium-icon
```

重新部署 Worker 后，新生成任务使用 `premium-icon`，前端、点数、队列和存储流程不需要修改。

## 9. 更换图片模型

### 9.1 同一供应商更换模型

如果仍然使用 OpenAI，只更换模型名称：

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=新的模型名称
```

修改后重新部署 Worker。

### 9.2 增加其他供应商

1. 在 `services/icon-worker/src/adapters/` 新建 Provider Adapter。
2. 实现 `ImageProvider` 接口。
3. 在 `services/icon-worker/src/registries.ts` 的 `createImageProvider` 中注册。
4. 配置新的供应商名称、模型和服务端密钥。
5. 运行测试并重新部署 Worker。

统一接口：

```ts
interface ImageProvider {
  readonly name: string;
  readonly model: string;
  generate(input: { prompt: string }): Promise<GeneratedImage>;
}
```

更换 Provider 不需要修改前端、任务状态、扣点、SQS 或 Supabase Storage 逻辑。

## 10. 普通用户请求边界

普通用户允许提交：

```json
{
  "description": "A meditation app for better sleep",
  "stylePreset": "minimal"
}
```

普通用户不能控制：

- `IMAGE_PROVIDER`
- `IMAGE_MODEL`
- `IMAGE_PROVIDER_API_KEY`
- `ICON_SKILL`
- Supabase Service Role Key

即使用户在请求中自行增加这些字段，后端也不会把它们作为模型运行配置。

## 11. 安全检查清单

- [ ] 真实 `.env` 文件没有提交到 GitHub。
- [ ] API Key 没有出现在浏览器请求和前端构建结果中。
- [ ] Supabase Service Role Key 只存在于服务端。
- [ ] 生产密钥存储在加密环境变量或 Secrets Manager。
- [ ] Lambda 日志不会输出 API Key。
- [ ] 模型供应商设置了费用上限或告警。
- [ ] Skill 修改后升级了版本。
- [ ] 上线前运行了类型检查和测试。

## 12. 常见错误

### `Unsupported IMAGE_PROVIDER`

原因：`IMAGE_PROVIDER` 没有在 `createImageProvider` 中注册。

处理：检查拼写，或者先完成新的 Provider Adapter 注册。

### `Unsupported ICON_SKILL`

原因：`ICON_SKILL` 没有出现在 `promptCompilerRegistry` 中。

处理：检查 Skill 名称，或者先注册新的 Skill。

### OpenAI authentication error

原因可能包括 API Key 错误、Key 已撤销、项目权限不足或账单未启用。

处理：在 OpenAI Platform 检查 Key、项目权限、账单和用量限制，然后重新部署服务端配置。

### Supabase permission error

原因通常是误用了 Anon Key，或者 Service Role Key 配置错误。

处理：Worker 必须使用服务端 `SUPABASE_SERVICE_ROLE_KEY`，不能使用前端 Anon Key。

## 13. MVP 推荐配置

第一版建议保持：

```env
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
ICON_SKILL=default-icon
GENERATION_MAX_ATTEMPTS=3
```

先完成一个模型、一个 Skill、每次生成 4 个 PNG 的闭环，再根据成本和效果增加其他模型或 Skill。

