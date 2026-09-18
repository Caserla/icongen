<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 全局组件主题契约

- 所有新增或重构的可视组件必须同时设计、实现并检查深色与浅色两套状态；只在一种主题下可读或可用，视为未完成。
- 组件的页面背景、表面、边框、分隔线、正文、弱化文字、图标、阴影，以及 default、hover、focus、selected、disabled、open 等状态必须使用语义主题变量，禁止仅以深色页面效果作为默认正确结果。
- 需要固定品牌色或特殊材质色时可以使用明确色值，但仍必须分别检查其在深浅背景上的对比度、边界和可辨识度；必要时提供主题覆盖值。
- 新组件交付前至少验证一次深色和浅色实际渲染。复用现有组件时也要确认继承的主题状态完整，不能假定已有类名自然兼容两套主题。
- 弹窗、抽屉、浮层和气泡的遮罩或外部背景也属于组件主题范围，必须与其父页面及内容表面一起适配。
