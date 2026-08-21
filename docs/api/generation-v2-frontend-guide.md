# 图片生成 API v2 前端调用手册

状态：共享契约已实现，后端接口待接入
契约源码：`packages/shared/src/generation-v2.ts`
设置源码：`packages/shared/src/design-settings.ts`

## 0. 获取生成设置

`GET /api/generation/settings` 是创建页的设置项来源，无需登录。响应包含 `version`、6 组 25 个核心选项、10 个允许的 PNG 尺寸，以及每批最多 20 个主体、每主体 3 个方案的限制。创建任务时必须原样提交响应中的 `version`，前端不得另行维护设置 ID。

## 1. 版本边界

- 新版生成单位为 `job → subjects → 3 variants → assets`。
- 每次任务包含 1–20 个主体，每个主体固定 3 个方案。
- 设置版本固定为 `core-settings-2026-08-20.1`。
- MVP 只使用 6 组 25 个核心选项，不提供高级模式。
- `packages/shared/src/generation.ts` 是旧版单主体/4 结果过渡契约，新页面不得继续新增依赖。

## 2. 前端必须从共享包读取的常量

```ts
import {
  CORE_SETTING_GROUPS,
  DESIGN_SETTINGS_VERSION,
  MAX_SUBJECTS_PER_JOB,
  OUTPUT_SIZES,
  VARIANTS_PER_SUBJECT,
  createGenerationJobSchema,
} from "@icongen/shared";
```

前端不得复制主体上限、尺寸、方案数或核心设置到页面文件中。

## 3. 创建任务

### `POST /api/generation/jobs`

请求必须先通过 `createGenerationJobSchema`。示例：

```json
{
  "idempotencyKey": "4c6be3f8-df54-4df1-b2ce-9fa2ec735705",
  "settingsVersion": "core-settings-2026-08-20.1",
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
  "coreSettings": {
    "graphicStructure": "outline",
    "visualTone": "rounded",
    "strokeWeight": "regular",
    "colorMode": "monochrome",
    "backgroundContainer": "none",
    "detailLevel": "auto"
  },
  "sizes": [24, 48, 128]
}
```

成功响应目标格式：

```json
{
  "jobId": "uuid",
  "status": "queued",
  "chargedCredits": 2,
  "resultUrl": "/icons/uuid"
}
```

前端提交成功后立即跳转 `resultUrl`，不等待图片生成。

## 4. 字段关联规则

- `subjects[].clientId` 在同一请求内必须唯一。
- `sizes` 至少一项且不得重复，只能使用 `OUTPUT_SIZES`。
- `background.enabled=false` 时，`coreSettings.backgroundContainer` 必须为 `none`。
- `background.enabled=true` 时必须提供容器和背景颜色，核心容器不能为 `none`。
- 主体颜色和背景颜色隐藏后不得继续作为生效字段提交。
- 接口不接受 Advanced settings 或原始 266 项分类值。

## 5. 查询任务

### `GET /api/generation/jobs/{jobId}`

响应使用 `generationJobResponseSchema`，至少包含：

- 任务状态：`queued / processing / completed / partial / failed`。
- `progress.percent` 与真实阶段、完成主体数和主体总数。
- 有序 `subjects[]`。
- 每个主体固定 3 个 `variants[]` 槽位。
- 每个成功方案的可用尺寸 `assets[]`。
- 本任务扣除和返还点数摘要。

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
