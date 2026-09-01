# 方案细节调整与版本还原

## 产品行为

- 已完成的方案卡片提供“细节调整”入口，在弹窗中展示当前版本并输入 5–500 字的局部修改要求。
- 调整期间保留当前图片，完成后结果页刷新为新版本；失败不影响原方案。
- 已调整方案支持“一键还原初始版本”。还原只切换版本指针，不调用模型、不覆盖或删除历史资产。

## Image2 调用

编辑请求同时携带两类图片，语义不可混淆：

1. `sourceImage`：当前方案的 RGBA PNG，是允许编辑的唯一主体；
2. `referenceImage`：对应风格参考图，只约束配色、造型、材质、深度和细节密度。

提示词要求只应用用户指定的局部变化，并保持主体身份、构图、画布、视觉尺寸、线宽、配色、背景模式、背景形状、圆角和其他未指定细节。透明背景继续经过色键转真实 Alpha；App 插画图标继续应用既有圆角遮罩规则。

## 数据与资产

迁移 `0014_variant_detail_edits.sql` 新增：

- `generation_variant_revisions`：不可变的编辑版本、状态、指令和资产清单；
- `generation_variants.active_revision_id`：当前生效版本指针；
- 同一方案最多一个 `queued / processing` 编辑，防止重复提交。

Storage 路径：

```text
generated-icons/{jobId}/{subjectId}/variant-{slot}/revisions/{revisionId}/
  source.png
  preview.png
  {size}.png
  output.svg（仅支持的风格）
```

原始 `generation_assets` 永远不变。结果读取和 ZIP 下载在存在有效修订时使用修订资产，否则使用初始资产。

## 失败与并发安全

- 编辑失败只把修订标记为 `failed`，不改变原方案和任务状态。
- 还原会取消尚未完成的编辑并清空生效指针。
- Worker 完成前再次确认修订仍为 `processing`；激活时同时核对父版本指针，避免过期 Worker 覆盖用户随后执行的还原或新编辑。
- SVG 派生失败只记录日志，调整后的 PNG 仍可正常交付。

## 部署与验收

1. 在 Supabase 执行 `infra/supabase/migrations/0014_variant_detail_edits.sql`。
2. 部署 Worker 和 Web，确保 Worker 可读取同一套 Supabase 与 Image2 配置。
3. 对带背景、透明背景、交互线性图标各测试一次局部调整。
4. 验证页面更新、原图与尺寸 PNG 下载、可选 SVG、连续再次调整及还原初始版本。
