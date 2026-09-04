# 前后端代码与 UI 架构审计（2026-09-04）

## 1. 本轮已处理

| 项目 | 发现的实际问题 | 本轮处理 | 验证方式 |
| --- | --- | --- | --- |
| 旧视觉皮肤 | 页面仍直接引用 `paper-panel`、`card-polish`、`surface-elevated`、`mechanical-button`、`soft-spot`，再依赖 `globals.css` 后置覆盖成深色，容易首屏闪旧样式并产生圆角杂色 | 页面引用及废弃 CSS 定义全部移除，统一使用 `studio-panel`、`studio-button`、`studio-notice`、`status-badge`、`studio-result-card` | 源码残留扫描、TypeScript、页面测试 |
| 反馈组件 | Toast、错误提示、警告提示各自硬编码旧暖色背景 | 收敛为 `studio-notice` 状态体系，Toast 复用同一颜色语义 | 组件测试、视觉类扫描 |
| 状态标签 | 通用状态组件内置旧浅色背景，列表页再用 CSS 强制覆盖 | 状态组件直接使用统一的深色状态语义 | 源码扫描、列表页回归 |
| 点数记录请求 | 首屏和筛选存在两套相同请求；快速切换时旧响应可能覆盖新筛选 | 统一到 `loadHistory`，增加请求序号，过期响应不再更新状态 | TypeScript、Web 测试 |
| Worker 数据库客户端 | Job、Edit、Daemon 三处重复 Service Role 客户端配置 | 抽出 `createWorkerSupabaseClient`，三条入口共用 | Worker TypeScript 与测试 |
| ZIP 下载依赖 | 移除在线支付代码时误删了与支付无关的 `jszip`，ZIP 下载无法编译 | 恢复 `jszip`，仍不恢复任何在线支付入口 | TypeScript、下载相关测试 |

## 2. 已有的有效抽象

- 创建页新组件已拆分为 `StudioRange`、`StudioSegmentedControl`、`StudioColorField`、`StudioColorPicker`、`StudioDisclosure`、`StudioDrawer`、`StudioSettingsPanel` 和 `StudioSideCard`。
- 图片加载统一使用 `ImageWithSkeleton`，页面骨架集中在 `page-skeletons.tsx`。
- 生成输入及响应由 `@icongen/shared` 的 Zod Schema 约束；前后端共用主体上限、描述长度、尺寸和状态枚举。
- 列表和详情读取分别集中于 server reader，短期签名 URL 按批次生成。
- 管理 API 已有统一的管理员鉴权、响应与输入 Schema 模块。
- Worker 已有 Provider、Prompt Compiler、资产存储、图片处理与质量门的适配器边界。

## 3. 仍值得继续拆分的代码

| 优先级 | 位置 | 实际规模/问题 | 建议边界 | 风险与收益 | 待人工处理 |
| --- | --- | --- | --- | --- | --- |
| P1 | `job-details.tsx` | 755 行，同时管理轮询、选择、下载、预览弹窗和主体/方案渲染 | 拆为 `useJobPolling`、`useVariantSelection`、`VariantGrid`、`DownloadBar`、`ImagePreviewDialog` | 中风险；可减少状态耦合与重复刷新回归 | 否 |
| P1 | `admin-dashboard.tsx` | 780 行，概览、曲线、用户、任务、CD-Key、审计混在单组件 | 每个 Tab 独立组件与 Query hook；按 Tab 动态加载 | 中风险；明显降低首屏 JS 和无关请求 | 否 |
| P1 | `variant-edit-dialog.tsx` | 613 行，轮询、草稿恢复、比较、计费错误和视图混合 | 拆为状态机 hook、版本比较区、编辑表单 | 中风险；降低“返回后丢状态”类问题 | 否 |
| P1 | `globals.css` | 656 行，路由级 `:has()` 覆盖与组件规则混合 | 拆为 tokens、shell、generation、library、account/admin 样式模块 | 中风险；需要逐页截图回归，能减少覆盖顺序问题 | 否 |
| P1 | `run-variant-edit.ts` | 370 行，数据读取、租约、模型生成、图片处理、上传和结算同文件 | 拆为 revision repository、asset publisher、edit orchestrator | 中风险；便于单测失败补偿与租约边界 | 否 |
| P2 | API 路由 | 32 个路由中 27 个存在独立异常捕获，错误映射较分散 | 提取 authenticated/admin route wrapper 与统一 public error mapper | 中风险；安全日志、错误码和缓存头更一致 | 否 |
| P2 | Job readers | 详情 332 行、列表 202 行，资产签名映射存在相似处理 | 提取 typed asset signer/batcher | 低至中风险；减少签名策略漂移 | 否 |

以上项目不是“没有优化空间”，而是需要分批实施。前三项涉及核心交互状态，必须在独立提交中配套真实浏览器回归，不能在一次视觉清理中大范围重写。

## 4. 性能优化清单

| 优先级 | 当前事实 | 建议 | 验收指标 | 待人工处理 |
| --- | --- | --- | --- | --- |
| P1 | 管理后台单组件包含所有 Tab 逻辑 | Tab 级代码分割和按需请求 | 非当前 Tab 不发请求，首屏 JS 下降 | 否 |
| P1 | 详情页轮询整个任务数据 | 未完成方案用轻量 summary；完成方案保持引用稳定 | 已完成图片不重新请求/闪烁，轮询响应体下降 | 否 |
| P1 | Worker Daemon 每个任务启动 npm 子进程 | 生产改为受控 worker pool 或直接调用 runner | 吞吐压测、内存上限和崩溃隔离通过 | 是：需按服务器规格定并发 |
| P1 | ZIP 在 Web 请求内存中同步构建 | 大包改对象存储异步归档，小包保留同步上限 | 64 MiB 边界内稳定；大包不占满 Web 内存 | 是：需对象存储生命周期策略 |
| P2 | 全局 CSS 依赖大量路由 `:has()` | CSS 模块化并让页面根节点显式携带主题 | 样式计算与覆盖数量下降，视觉截图无差异 | 否 |
| P2 | 生成图片和风格预览资源较多 | 校验 preload 优先级、响应尺寸和长期缓存 | LCP/图片传输量在目标设备达标 | 是：需生产 CDN 数据 |

## 5. 维护约束

1. 禁止新页面重新使用已删除的旧皮肤类。
2. 新的面板、按钮、提示、状态和结果卡优先使用统一语义类或已有 Studio 组件。
3. 超过 500 行且同时承担数据请求与复杂视图的组件，新增功能前应先拆边界。
4. 抽象必须保持业务语义；计费、租约、退款和资产发布不得只做 UI 层封装。
5. 每次样式迁移需同时扫描旧 token、运行 TypeScript/测试并验证加载态、错误态、空态和移动端。

## 6. 本轮验收结果

| 检查项 | 结果 |
| --- | --- |
| 旧皮肤类扫描 | `paper-panel`、`card-polish`、`surface-elevated`、`mechanical-button`、`soft-spot`、`panel-shadow` 在 `apps/web/src` 中均为 0 |
| 全 Workspace TypeScript | 通过（Web、Backend Core、Icon Skill、Shared、Worker） |
| ESLint | 通过，0 error / 0 warning |
| 全仓自动化测试 | 169/169 通过：脚本 8、Web 70、Icon Skill 15、Shared 9、Worker 67 |
| 生产构建 | Next.js 生产构建成功，34 个静态页面数据单元生成完成 |
| 数据库 bootstrap | 从 26 个迁移重新生成成功 |
| Git whitespace | `git diff --check` 通过 |

本轮没有执行会产生模型费用的真实图片生成，也没有把生产环境人工项目标记为通过。
