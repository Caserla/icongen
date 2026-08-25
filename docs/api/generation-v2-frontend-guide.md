# 图片生成 API v2 前端调用手册

状态：共享契约已实现，后端接口待接入
契约源码：`packages/shared/src/generation-v2.ts`
设置源码：`packages/shared/src/design-settings.ts`

## 0. 获取生成设置

`GET /api/generation/settings` 是创建页的设置项来源，无需登录。响应包含 `version`、10 个稳定风格预设、3 组兼容风格微调、6 个允许的 PNG 尺寸、最多 3 种参考尺寸和每主体 3 个方案的规则。App 图标页面隐藏仅供交互用途的 `line-icon`，因此展示其余 9 种 App 图标风格。创建任务时必须原样提交响应中的 `version`，前端不得另行维护设置 ID。

## 1. 版本边界

- 新版生成单位为 `job → subjects → 3 variants → assets`。
- 每次任务至少包含 1 个主体，不设置产品层面的主体数量上限；每个主体固定 3 个方案。
- 当前设置版本为 `icon-style-2026-08-25.7`；前端必须使用设置接口返回值，不得硬编码。
- MVP 先选择一套图标设计风格，再作有限的风格微调，不提供高级模式。
- `packages/shared/src/generation.ts` 是旧版单主体/4 结果过渡契约，新页面不得继续新增依赖。

## 2. 前端必须从共享包读取的常量

```ts
import {
  CORE_SETTING_GROUPS,
  DESIGN_SETTINGS_VERSION,
  OUTPUT_SIZES,
  VARIANTS_PER_SUBJECT,
  createGenerationJobSchema,
} from "@icongen/shared";
```

前端不得复制尺寸、方案数或核心设置到页面文件中。

## 3. 创建任务

### `POST /api/generation/jobs`

本接口只处理图标设计规格与生成任务。点数展示、报价、扣点和退款属于独立商业化模块，不是本接口的请求或响应字段。

请求必须先通过 `createGenerationJobSchema`。示例：

```json
{
  "idempotencyKey": "4c6be3f8-df54-4df1-b2ce-9fa2ec735705",
  "settingsVersion": "icon-style-2026-08-22.1",
  "subjects": [
    {
      "clientId": "search",
      "name": "Search",
      "description": "Magnifier for finding content"
    },
    {
      "clientId": "delete",
      "name": "Delete",
      "description": "Trash can for deleting content"
    }
  ],
  "subjectColor": {
    "mode": "solid",
    "color": "#6D4AFF"
  },
  "background": {
    "enabled": false
  },
  "style": {
    "preset": "rounded-outline",
    "strokeWeight": "regular",
    "cornerStyle": "soft",
    "detailLevel": "standard"
  },
  "sizes": [24, 48, 128]
}
```

成功响应格式：

```json
{
  "id": "uuid",
  "status": "queued"
}
```

前端提交成功后使用 `id` 跳转 `/icons/{id}`，不等待图片生成。

## 4. 字段关联规则

- `subjects[].clientId` 在同一请求内必须唯一。
- `sizes` 至少一项、最多三项且不得重复，只能使用 `OUTPUT_SIZES`。
- `style` 是本次批量任务的统一设计语言：必须选择一个预设，并提供线条粗细、转角语言、细节密度三项微调。
- `background.enabled=true` 时必须提供背景颜色，并在 `rounded-square / circle / square` 中选择一种容器。
- 主体颜色和背景颜色隐藏后不得继续作为生效字段提交。
- 接口不接受原始 6 维 / 25 项分类值或模型运行参数。

## 5. 查询任务

### `GET /api/generation/jobs/{jobId}`

返回 `progress.percent`、`progress.phase`、`completedSubjects`、`totalSubjects` 和可选的 `currentSubjectName`，供结果页展示真实百分比与双语提示文本；响应不包含点数摘要。

响应使用 `generationJobResponseSchema`，至少包含：

- 任务状态：`queued / processing / completed / partial / failed`。
- `progress.percent` 与真实阶段、完成主体数和主体总数。
- 有序 `subjects[]`。
- 每个主体固定 3 个 `variants[]` 槽位。
- 每个成功方案的可用尺寸 `assets[]`。

轮询建议：前台每 2 秒一次；页面进入后台后降低频率；完成、部分成功或失败后停止。

## 6. 首版错误处理

| 错误码 | 前端动作 |
| --- | --- |
| `VALIDATION_ERROR` | 定位字段并保留草稿 |
| `SETTINGS_VERSION_EXPIRED` | 刷新核心设置并要求确认变化 |
| `INSUFFICIENT_CREDITS` | 打开价格页并保留草稿 |
| `ACTIVE_JOB_LIMIT_REACHED` | 保留草稿，打开当前活动任务 |
| `CONTENT_POLICY_BLOCKED` | 标记具体主体并提供支持邮箱 |
| `GENERATION_QUEUE_FAILED` | 展示安全重试，不得重复扣点 |
| `RESOURCE_FORBIDDEN` | 显示无权限，不泄露资源存在性 |

## 7. 当前迁移顺序

1. 数据库迁移到 job/subject/variant/asset 模型。
2. `POST /api/generation/jobs` 改用 `createGenerationJobSchema`。
3. Worker 消费 v2 Queue Message，并按主体创建 3 个工作单元。
4. `/create` 改为 v2 表单；结果页改用 `generationJobResponseSchema`。
5. 旧 `createGenerationSchema` 和旧 `GenerationJob` 已删除，前端不得重新引入 v1 类型。
