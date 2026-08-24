# ADR-0003：UI 图标生成设置精简

- 状态：已确认
- 日期：2026-08-20
- 依据：主流 UI 图标系统强调简单隐喻、小尺寸清晰度、统一线宽、统一视角和有限颜色

## 决策

- MVP 只实现 6 组、25 个核心选项，覆盖常用 UI 功能图标的主要设计决策。
- MVP 不提供 Advanced settings，不把完整 266 项接入前端、生成接口或后端校验。
- 原始 10 维度、266 项清单仅保留为未来版本研究参考，不能视为首版产品能力。
- Representation、Camera/View、Material、Shadow/Lighting 由 Skill 内部固定。
- 增加原 taxonomy 缺少但对 UI 图标生产更重要的 Stroke Weight。
- 同一主体的 3 个方案只改变视觉隐喻或构图，不改变批次级线宽、颜色、圆角、视角和细节规则。

## 默认 6 组设置

| 设置组 | 选项数 | 选项 |
| --- | ---: | --- |
| 图形结构 | 4 | Outline、Filled、Line + Fill、Duotone |
| 视觉气质 | 5 | Neutral、Rounded、Bold、Playful、Technical |
| 线条粗细 | 4 | Light、Regular、Medium、Bold |
| 配色方式 | 4 | Monochrome、Two-tone、Multicolor、Gradient |
| 背景容器 | 5 | None、Circle、Square、Rounded Square、Pill |
| 细节程度 | 3 | Auto、Minimal、Standard |

合计 25 个核心选项。主体颜色、背景颜色、渐变方向和输出尺寸继续作为独立设置，不计入上述分类数量。

## 默认系统推导

- Representation：`Glyph / UI Icon`
- Camera / View：`Front / Orthographic`
- Material：`None / Flat`
- Shadow & Lighting：`None`
- Complexity：选择 Auto 时根据最小输出尺寸自动映射

## 后续扩展

完整 266 项不进入 MVP。未来只有在核心闭环数据证明用户确实需要材质、3D、特殊视角或复杂光影后，再单独立项设计高级模式。

## 影响

- 前端默认表单显著缩短，移动端不需要浏览大规模选项树。
- 共享代码和接口只维护 25 个核心选项，明显降低首版实现与测试成本。
- Skill 输入新增批次级 stroke、optical scale 和 consistency lock。
- 生成验收从“每张图好看”调整为“同批图标形成一致系统”。
> 当前创建页仅开放圆角、圆形、方块三种背景类型；None 由背景开关表达，Pill 保留在版本化分类目录中但不展示、不提交。
