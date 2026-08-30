# SVG 输出链路调整方案

## 目标与边界

Bamboo IconGen 保留 GPT-Image-2 生成 PNG 的主链路，在 Worker 资产处理阶段派生 SVG。第一阶段只为以下任务提供 SVG：

- App 交互图标：线性与面性结构；
- App 图标：`minimal-logo`（极简标志）。

等距 3D、霓虹、低多边形、黏土 3D、扁平活泼、像素艺术、扁平插画和可爱贴纸暂不提供 SVG，避免产生路径过多、文件体积过大或视觉失真的伪矢量结果。

## 最终链路

1. Image Provider 返回原始 PNG。
2. Worker 保存 `source.png`，生成 `preview.png` 和用户选择尺寸的 PNG。
3. 对受支持任务调用 VTracer：线性和极简标志使用黑白追踪，面性结构使用彩色分层追踪。
4. SVG 经优化和安全检查后保存为 `output.svg`。
5. `generation_assets` 使用 `asset_role + size + format` 区分 PNG 与 SVG。
6. 结果页继续用 PNG 预览；下载包始终包含原图和任务选择的全部 PNG 尺寸。
7. 支持 SVG 的风格在下载按钮左侧显示“包含 SVG”复选框；勾选后追加 SVG，不勾选则不包含。

## 数据与 Storage

迁移 `0012_svg_output_assets.sql` 新增 `format`、`mime_type`，唯一约束调整为 `variant_id, asset_role, size, format`。旧资产默认按 PNG 读取。

```text
generated-icons/{jobId}/{subjectId}/variant-{slot}/
  source.png
  preview.png
  64.png
  128.png
  256.png
  output.svg
```

共享响应协议为资产增加 `format`，为方案增加 `vectorUrl`；下载请求增加 `format`，只有 PNG 下载必须携带 `size`。

## 矢量化与安全

- 使用 `@neplex/vectorizer`（VTracer）本地矢量化，不增加外部 API 调用或 Image2 费用。
- 黑白模式先将透明区域铺白，再灰度化和阈值化，避免透明画布被识别为实色背景。
- SVG 使用安全优化预设和多轮压缩。
- 保存前拒绝 `script`、`foreignObject`、事件属性及外部/数据 URL 引用。
- 前端使用签名 URL 与 `<img>`，不把 SVG 字符串注入 HTML。

## 兼容策略

- 旧数据库没有 `format` 时，读取与 PNG 下载保留旧字段回退。
- 新 Worker 写入 SVG 前必须先部署迁移 `0012`。
- 旧任务不会自动拥有 SVG；后续可从既有 source PNG 增加回填任务，无需重新调用 Image2。
- 第一阶段 SVG 与 PNG 同任务生成；复杂风格选择 SVG 时前端给出不支持提示。

## 部署顺序

1. 在 Supabase 执行 `infra/supabase/migrations/0012_svg_output_assets.sql`。
2. 部署 Worker及其 VTracer 依赖。
3. 部署 Web 的 SVG 读取与 ZIP 下载功能。
4. 新建线性交互图标、面性交互图标和极简标志任务进行端到端验证。
5. 验证复杂风格只生成 PNG，SVG 下载显示明确提示。

## 验收标准

- 受支持任务每个成功方案包含所选 PNG 尺寸和一份 SVG；
- SVG 可在浏览器、Figma 或 Sketch 中打开并保持可缩放路径；
- SVG ZIP 文件名不包含尺寸；PNG 同时包含 `original` 母版和各交付尺寸；
- 旧 PNG 任务继续正常展示和下载；
- SVG 不包含脚本、远程资源或事件处理器；
- Worker、Shared、Web 类型检查与测试全部通过。
