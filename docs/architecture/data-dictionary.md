# 生成域数据字典

更新时间：2026-09-01

本页描述当前生成域的核心数据对象。字段与约束的最终来源是 `infra/supabase/migrations` 和 `packages/shared/src/generation-v2.ts`。

## generation_jobs

- 一次用户提交对应一个任务。
- 保存用户、任务状态、完整 `generation_spec` 快照、设置/Skill 版本、进度、创建与完成时间。
- 状态为 `queued / processing / completed / partial / failed`。
- 同一用户的活动任务限制和幂等创建由数据库函数及索引保证。

## generation_subjects

- 一个任务包含 1–20 个主体。
- 保存稳定 `client_id`、名称、描述、顺序、主体级颜色和背景覆盖及状态。
- App 插画图标的背景模式、形状和圆角设置跟随主体保存，删除主体时不得与其他主体设置错位。

## generation_variants

- 每个主体固定拥有 slot 1、2、3 三个方案，`(subject_id, slot)` 唯一。
- 保存方案状态、错误诊断、Skill/模型执行信息和实际提示词记录。
- 失败方案可以单独重新入队；已完成方案不会因同任务其他方案重试而重新生成。

## generation_assets

- 资产通过 `variant_id + asset_role + size + format` 区分。
- `source/png`：供应商返回并完成必要 Alpha/圆角处理后的母版。
- `preview/png`：结果页使用的 512px 预览。
- `output/png`：用户选择的 16–256px 输出。
- `output/svg`：仅受支持任务的本地矢量派生结果。
- Storage Bucket 为私有；Web 只返回短时签名 URL。

## generation_spec

- `purpose`：`interaction` 或兼容协议值 `app-icon`。
- `subjects`：主体名称、描述及可选颜色/背景覆盖。
- `subjectColor`、`background`：任务级默认值。
- `style`：预设、线性/面性、主体占比、线宽及兼容风格字段。
- `sizes`：从 16、32、48、64、128、256 中选择 1–3 项。
- `settingsVersion` 与 `idempotencyKey` 必填。

## 后续版本编辑扩展

方案细节调整不覆盖现有资产。计划新增不可变 revision 记录和 `active_revision_id` 指针；下载与预览读取当前启用版本，还原仅切换指针，不重新调用模型。
