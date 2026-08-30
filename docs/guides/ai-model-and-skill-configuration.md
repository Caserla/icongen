# Bamboo IconGen AI 模型与 Skill 配置说明书

文档版本：1.0  
适用项目：Bamboo IconGen
适用对象：Bamboo IconGen 平台开发者、部署人员和管理员

## 1. 文档目的

本文说明如何为 Bamboo IconGen 配置图片生成模型、API Key 和 Icon Skill。

这些配置由 Bamboo IconGen 平台提供方统一管理，不开放给网站普通用户。用户只能提交 UI 图标主体、颜色、背景、图标设计风格及尺寸，不能指定模型、供应商、API Key 或内部 Skill。

## 2. 配置关系

```text
普通用户
  → 提交多个图标主体和结构化设计设置
  → Bamboo IconGen 后端生成任务
  → Worker 读取平台部署配置
  → 调用已启用的 Icon Skill
  → 通过 Sub2API 调用已启用的 AI 图片模型
  → 为每个主体保存并返回 3 个 PNG 方案
```

平台方控制以下配置：

| 配置项 | 示例 | 说明 |
| --- | --- | --- |
| `IMAGE_PROVIDER` | `openai` | 图片模型供应商 |
| `IMAGE_MODEL` | `gpt-image-2` | 使用的图片模型 |
| `IMAGE_QUALITY` | `high` | 平台统一使用的图片生成质量档位 |
| `IMAGE_SIZE` | `2048x2048` | Image 2 高清母版生成尺寸 |
| `IMAGE_PROVIDER_BASE_URL` | `http://sub2api:8080/v1` | 合并部署时Sub2API在私有容器网络中的OpenAI-compatible地址 |
| `IMAGE_PROVIDER_API_KEY` | `sk-...` | 为 Bamboo 单独创建的 Sub2API 服务端 API Key |
| `ICON_SKILL` | `default-ui-icon` | 当前启用的 Icon Skill |

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
IMAGE_QUALITY=high
IMAGE_SIZE=2048x2048
IMAGE_PROVIDER_BASE_URL=http://sub2api:8080/v1
IMAGE_PROVIDER_API_KEY=填写Bamboo专用Sub2API密钥

ICON_SKILL=default-ui-icon

SUPABASE_URL=填写Supabase项目地址
SUPABASE_SERVICE_ROLE_KEY=填写Supabase服务端密钥
SUPABASE_ICON_BUCKET=generated-icons

GENERATION_MAX_ATTEMPTS=3
```

### 4.3 字段说明

- `IMAGE_PROVIDER`：供应商注册名称。当前内置值为 `openai`。
- `IMAGE_MODEL`：供应商提供的实际图片模型名称。
- `IMAGE_QUALITY`：图片生成质量，平台默认使用 `high`，普通用户不能修改。
- `IMAGE_SIZE`：Image 2 母版尺寸，默认使用 `2048x2048`；64/128/256 等交付尺寸由 Worker 缩放，不写入提示词。
- `IMAGE_PROVIDER_BASE_URL`：合并部署时为Sub2API在私有容器网络中的OpenAI-compatible `/v1` 地址；不得发送到浏览器。
- `IMAGE_PROVIDER_API_KEY`：为 Bamboo 单独签发、可撤销且有限额的 Sub2API 密钥。
- `ICON_SKILL`：Skill 注册名称。当前内置值为 `default-ui-icon`。
- `SUPABASE_URL`：Supabase 项目 URL。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase Service Role Key，只能在服务端使用。
- `SUPABASE_ICON_BUCKET`：生成结果存储桶，默认是 `generated-icons`。
- `GENERATION_MAX_ATTEMPTS`：任务最大处理次数，默认是 3。

## 5. 正式环境配置

本地开发由 Web BFF 在创建任务后直接启动 Worker。短期月付 VPS 测试环境按 [ADR-0004](../decisions/0004-monthly-vps-test-deployment.md) 部署独立常驻 Worker，全局并发限制为 1；正式生产执行平台在公开上线前重新评估。所有环境继续复用现有 Supabase 架构，未经项目确认不引入额外云服务或队列。

服务端执行环境最终至少需要以下变量：

```text
IMAGE_PROVIDER=openai
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=high
IMAGE_SIZE=2048x2048
IMAGE_PROVIDER_BASE_URL=http://sub2api:8080/v1
IMAGE_PROVIDER_API_KEY=Bamboo专用Sub2API API Key
ICON_SKILL=default-ui-icon
SUPABASE_URL=Supabase项目地址
SUPABASE_SERVICE_ROLE_KEY=Supabase服务端密钥
```

这些变量只能保存在服务端安全环境中，网站用户无法看到或修改。

Sub2API与Bamboo合并在同一VPS，但保持为独立容器服务，并使用自己的PostgreSQL与Redis。其管理入口不得直接公开，数据库与Redis不得暴露公网；Bamboo专用Key应配置额度、并发/速率限制和可独立撤销能力。Worker所调用的端点必须实现`POST /v1/images/generations`并返回`data[0].b64_json`。

## 6. 默认 Icon Skill

### 6.1 文件位置

默认 Skill 入口位于：

```text
packages/icon-skill/src/index.ts
```

Skill `0.8.8` 使用与 imagegen 相同的分层生成思路，但部署时不会调用 Codex 内置工具；Worker 仍通过 OpenAI-compatible Image2 Provider 调用模型。Skill 包含：

- Skill 名称和版本。
- 每个图标主体 3 个方案的差异化设计方向。
- 交互图标与 App 图标两套用途模板。
- 所有 App 图标风格统一经过固定生产模板：用途、单一主体、风格指纹、构图与安全区、色彩/材质/层次、方案差异、边缘与小尺寸质量、生产边界和输出契约。
- 黏土 3D、等距 3D、像素艺术、低多边形、霓虹、可爱贴纸、扁平插画和极简标志分别注入独立详细 style spec；扁平活泼在同一模板调用链中注入与 `flat-playful-icon-library` 同源的专用规则。统一的是生产结构，不会把其他风格转换成扁平活泼外观。
- 九种 App 图标风格均注册一张已确认的 1536×1024 参考模板板，并将其稳定视觉特征提炼为文字参考档案，随对应 style spec 一起进入提示词。
- 所有风格共用的单资产、可见元素、安全边距、禁止合集/展示板等生产边界。
- App 图标默认生成约 22% 圆角的风格化彩色背景，圆角外使用真实透明通道；只有主体描述明确要求无背景或透明背景时才移除背景容器。
- 九种风格统一采用透明交付三层隔离：视觉提示词不描述棋盘格、白底或 Alpha 验收失败；文件输出仅追加一句原生 RGBA PNG 指令；Worker 在生成后检测明显绘制棋盘格并阻止错误资产交付。
- 九种风格的圆角彩色背景统一使用单一自身色边界，禁止额外 outline、rim、stroke、keyline、frame 或外圈，避免生成浅色 border。
- 九种风格的有背景母版统一要求背景自身颜色铺满整张方形画布，不再让模型绘制外边距或圆角；约 22% 圆角及角外透明区域统一由 Worker 的 Alpha 遮罩生成，消除模型把安全边距画成白色月牙边的问题。
- 扁平活泼风格为三个方案分别指定确定的纯色背景值，要求背景未被主体遮挡的像素保持恒定 RGB；删除会诱导模型绘制独立容器的 `transparency outside the colored container` 输出描述。
- Worker 的纯色满版背景质量门检测边缘色不一致、雾化喷绘和内嵌圆形/色块面板；不合格方案不进入资产交付，并在同一方案内自动重试 Image2，最多 3 次。
- 背景契约扩展到全部九种 App 图标风格：黏土 3D、等距 3D、像素艺术、低多边形、可爱贴纸、扁平插画、扁平活泼和极简标志使用确定的均匀纯色满版背景；霓虹使用确定、连续、受控的深色平滑渐变。主体材质、光照和阴影不得扩散到背景。
- Worker 的纯色背景质量门同步覆盖上述八种纯色风格；发现雾化、喷绘、色差或内嵌面板时阻止交付并自动重试。
- Skill 将目标背景模式、色值、风格检测档位、色差容忍度和覆盖率阈值作为结构化 `qualityContract` 交给 Worker；Worker 不再只从图片四角猜测背景规则。
- 纯色检测改为从四角向内进行边缘连通区域分析，分别记录边缘覆盖率、画布覆盖率、目标色差和实际观察色；flat、material、pixel、illustration 使用独立阈值。
- 单方案失败时立即落库为 `failed` 并保存具体错误，不再等待任务级失败收口，确保 `partial` 或 `failed` 任务中不存在遗留的 `queued` 方案。
- 数据库迁移 `0013_preserve_variant_failure_diagnostics.sql` 使任务级收口只关闭仍处于 `queued`/`processing` 的方案，不再覆盖 Worker 已写入的单方案覆盖率与色差诊断。
- `GenerationSpec`（主体、颜色、背景、风格、尺寸）到结构化模型提示词的编译逻辑。
- 原图、512px 预览和正式输出三层资产要求；Worker 另执行不调用模型的质量告警检查。

创建页的风格目录预览与生成 Skill 相互独立。当前「扁平活泼」预览使用 `flat-playful-girl-fullbleed-v24.png`：原图为满版直角粉色背景，页面与其他风格一致，统一由前端 18% 遮罩处理圆角；该资源只用于前端选择风格时的视觉说明，不会作为生成任务的输入图。

九张已确认的参考模板板保存在 `packages/icon-skill/assets/style-references/`，用于人工审核、风格版本追踪和回归对比。与 `flat-playful-icon-library` 的参考图边界一致，24 图宫格不会直接发送给 Image2：合集图容易让模型复现宫格、多个主体、留白和展示板结构。实际模型调用只发送从参考板提炼并固化的文字视觉特征。若以后需要图像条件输入，应为每种风格准备单主体参考资产，不复用 24 图宫格。

### 6.2 名称和版本

```ts
export const ICON_SKILL_NAME = "default-ui-icon";
export const ICON_SKILL_VERSION = "0.8.8";
```

修改提示词或 style spec 后应升级版本。例如：

```ts
export const ICON_SKILL_VERSION = "0.8.8";
```

数据库会记录任务实际使用的供应商、模型、Skill 名称和 Skill 版本，方便追踪历史结果。

### 6.3 Skill 的含义

当前 Icon Skill 是 Bamboo IconGen 后端中的 TypeScript 业务模块，不是安装在 ChatGPT 或 Codex 中的 `SKILL.md`。它会随后台生成服务一起构建和部署。

## 7. 修改默认 Skill

如果只需要调整默认提示词，可以直接修改：

```text
packages/icon-skill/src/index.ts
```

建议步骤：

1. 在 `purpose-specs/` 修改用途模板。
2. 在 `style-specs/` 修改某一风格的几何、色彩、材质、光照、边缘和小尺寸规则。
3. 在 `production-boundaries.ts` 修改所有风格共享的生产边界。
4. 升级 `ICON_SKILL_VERSION`。
5. 运行类型检查和测试。
6. 重新部署后台生成服务。

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
    subject: { name: string; description: string };
    spec: GenerationSpec;
    slot: 1 | 2 | 3;
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
  "default-ui-icon": defaultIconSkill,
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
  generate(input: { prompt: string; quality: "high"; size: "2048x2048" }): Promise<GeneratedImage>;
}
```

更换 Provider 不需要修改前端、任务状态、扣点或 Supabase Storage 逻辑。

## 10. 普通用户请求边界

普通用户允许提交的业务参数示例：

```json
{
  "subjects": [
    { "name": "Search", "description": "Magnifier for finding content" }
  ],
  "settingsVersion": "<version from GET /api/generation/settings>",
  "style": {
    "preset": "isometric-3d",
    "strokeWeight": "regular",
    "cornerStyle": "balanced",
    "detailLevel": "standard"
  },
  "sizes": [24, 48, 128]
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
- [ ] 服务端日志不会输出 API Key。
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
IMAGE_QUALITY=high
IMAGE_SIZE=2048x2048
ICON_SKILL=default-ui-icon
GENERATION_MAX_ATTEMPTS=3
```

先完成一个模型、一个 Skill、每个主体 3 个 PNG 方案的闭环，再根据成本和效果增加其他模型或 Skill。核心设置与最终 Prompt 的映射由 Skill 负责，普通用户不能修改内部模板。

## 14. 当前代码与真实 API 生效条件

真实图片生成需要同时满足：

1. 平台方在 Worker 环境配置有效的 `IMAGE_PROVIDER_API_KEY`。
2. `IMAGE_MODEL` 设置为账户实际可用的模型名称。
3. Worker 已读取 `IMAGE_QUALITY=high` 和 `IMAGE_SIZE=2048x2048`。
4. OpenAI Provider 已在 `images.generate` 中显式传入质量配置。
5. Worker 已部署，且队列、Supabase 和私有存储配置有效。

当前代码已经支持 `IMAGE_PROVIDER`、`IMAGE_MODEL`、`IMAGE_QUALITY` 和平台 API Key。未配置真实 Key 时使用 Mock Provider 开发页面、任务状态、进度、点数和下载流程。
