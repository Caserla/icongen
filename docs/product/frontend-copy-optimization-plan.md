# Bamboo IconGen 前端文案优化方案

> 历史优化记录：本文用于追溯文案调整过程，不是当前页面文案的唯一来源。当前产品命名以“App 交互图标 / App 插画图标”和实际前端代码为准。

> 状态：已于 2026-08-26 应用到前端代码
> 审计日期：2026-08-26
> 覆盖语言：英文、简体中文
> 方法：Copywriting 内容策略审计 + Professional Proofreader 最终校对

## 1. 项目与文案任务理解

Bamboo IconGen 面向独立开发者、产品经理和小型产品团队，帮助用户按统一规格生成 UI 图标 PNG。当前核心流程包括：

1. 选择图标用途：App 交互图标或 App 图标。
2. 添加一个或多个图标主体。
3. 配置图形结构、颜色、背景、风格与参考尺寸。
4. 为每个主体生成 3 个备选方案。
5. 查看实时进度、重试失败方案并打包下载。
6. 在“我的图标”中查看历史任务，在账户页管理资料与点数。

### 文案 North Star

> 让用户快速理解：不必逐个设计和反复写提示词，也能生成一套风格统一、规格明确、可直接比较和下载的 UI 图标。

### 读者与访问意图

| 页面 | 主要读者 | 意图温度 | 文案任务 |
| --- | --- | --- | --- |
| 首页、价格页 | 首次访问者 | 冷至温 | 解释产品、建立预期、推动首次生成 |
| 登录、注册 | 已有明确意图的访客 | 温至热 | 减少阻力，说明下一步 |
| 创建页 | 已登录用户 | 热 | 帮助正确配置并成功提交 |
| 结果页、我的图标 | 已提交任务的用户 | 热 | 解释进度、异常和下一步动作 |
| 账户、支付 | 现有用户 | 热 | 清楚说明点数、支付和高风险操作 |
| 管理后台 | 内部运营人员 | 热 | 准确呈现模块状态，避免技术实现泄漏 |

### 语气基线

项目尚未建立正式 `VOICE.md` 或品牌语气指南。以下基线根据现有产品定位与已上线文案推导，需在实施前由产品负责人确认：

- 直接具体：说清用户会得到什么，不用“真正需要”“强大”等抽象修饰。
- 友好克制：语气温和，但不卖萌、不夸张、不使用感叹号堆叠情绪。
- 懂设计但不炫技：使用“图标主体、备选方案、透明背景”等用户能理解的术语，避免暴露数据库、Provider、迁移函数等内部概念。
- 高风险场景冷静明确：支付、删除账户、生成失败时，说明发生了什么、是否丢失数据、用户下一步能做什么。

## 2. 总体诊断

### 做得好的部分

- “每个图标主体默认生成 3 个方案”和“1 点 = 1 个主体的 3 个方案”已经形成稳定规则。
- 创建页已按“用途 → 主体 → 尺寸”组织，基础层级清楚。
- 结果页已有阶段化进度、单方案重试和批量下载，核心动作完整。
- 双语覆盖范围较完整，大部分标准控件标签可直接保留。

### 需要优先解决的问题

1. **价值表达重复且抽象。** 首页与创建页反复使用“真正符合你实际需求”，没有突出“统一风格、批量配置、每个主体 3 个方案”等可验证价值。
2. **部分文案与当前交互不完全一致。** “输入多个图标需求”容易让用户以为应在一个输入框中一次输入多个需求，而当前界面是“一个输入项对应一个主体，可继续添加”。
3. **内部术语泄漏。** “Generation job”“Creating task”“database generation function has not been deployed”等表述更像开发日志，不适合最终用户。
4. **错误信息缺少恢复路径。** 多数错误只说明“We could not…”，没有告诉用户是刷新、稍后重试、返回修改还是联系支持。
5. **CTA 偏泛。** “Choose pack”“Continue”“Enter workspace”等按钮没有明确点击结果。
6. **中英文意图偶有偏差。** 例如英文“choose the strongest result”比中文“选出最合适的结果”更带主观评价；“按你的实际生成需求购买”也不够自然。
7. **未完成能力使用已完成语气。** 支付页直接要求用户“配置 Stripe”，把开发配置责任交给普通用户；管理后台也用未来时描述未完成能力。

## 3. 优化原则与实施顺序

### P0：任务状态、错误与高风险操作

- 错误结构统一为：发生了什么 + 当前影响 + 下一步动作。
- 用户可恢复的问题提供明确动作，如“刷新设置”“返回修改”“重新生成”。
- 平台配置问题只说“该功能暂不可用”，不要让普通用户配置 Stripe、数据库函数或服务密钥。
- 删除账户明确 30 天宽限期、取消方式和不可逆结果。

### P1：首页、创建与登录转化

- 首页首屏从抽象愿景改为“统一风格 + 一次配置 + 3 个方案”的结果承诺。
- 创建页严格匹配当前“逐项添加主体”的交互。
- 登录注册页删去重复副标题，让标题、说明和主按钮分别承担一个任务。
- CTA 使用“动词 + 结果”，例如“开始生成”“购买 75 点”。

### P2：账户、支付、后台与元数据

- 统一点数、主体、方案、任务等术语。
- 支付页明确购买内容和跳转行为。
- 后台文案面向运营任务，不罗列内部技术实现。
- SEO 描述避免未经证明的“production-ready”，改为可验证功能。

## 4. 核心页面文案前后对比

以下为建议改动。未列入本节的标准标签、字段名和方向选项在第 6 节标记为“保留”。

### 4.1 首页

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| Eyebrow | AI UI icon generation / AI UI 图标生成 | AI icon sets for apps / 为 App 生成成套图标 | 从技术类别转向使用结果 |
| H1 | Create the UI icon library you truly need. / 生成一套真正符合你实际需求的 UI 图标库 | Create a consistent UI icon set in one workflow. / 一次配置，生成一套风格统一的 UI 图标 | 删除抽象的“truly need”，突出统一与流程效率 |
| 首屏说明 | Enter multiple icon requirements, define the colors, backgrounds, and visual style, then generate a consistent UI icon set and choose the best result from multiple options. / 输入多个图标需求…… | Add each icon you need, set one shared visual direction, and get three options for every icon to compare and download. / 逐个添加所需图标，统一设置视觉方向；每个图标生成 3 个方案，方便比较和下载。 | 与当前逐项添加交互一致，并给出数量与结果 |
| 主 CTA | Generate icons / 立即生成图标 | Start creating icons / 开始生成图标 | 英文增加启动感，双语意图一致 |
| 能力区标题 | Everything you need to create a complete icon set / 生成一套完整图标所需的核心能力 | One workflow from icon list to downloadable set / 从图标清单到成套下载，一步步完成 | 避免“everything”式无边界承诺 |
| 步骤 1 标题 | Generate multiple icons at once / 一次生成多个图标 | Add every icon your product needs / 添加产品所需的全部图标 | 准确反映逐项添加、批量提交 |
| 步骤 1 说明 | Enter multiple icon requirements at once and generate a consistent icon set in one batch. / 一次输入多个图标需求…… | Add one subject per field, then submit the set together with shared settings. / 每个输入项填写一个图标主体，添加完成后按同一套规格提交生成。 | 消除“一个输入框写多个主体”的误解 |
| 步骤 2 标题 | Precisely shape your ideal icon style / 精确塑造你理想的图标风格 | Set one visual direction for the set / 为整套图标统一视觉方向 | 更具体、少营销腔 |
| 步骤 2 说明 | Fine-tune the color, background, structure, and visual style to create exactly the icon look you want. / 自由调整…… | Choose structure, color, background, style, and reference sizes before generation. / 生成前统一选择图形结构、颜色、背景、风格和参考尺寸。 | 只承诺真实可设置项 |
| 步骤 3 标题 | Three options generated for every icon by default / 每个图标默认生成 3 种方案 | Compare three options for every icon / 每个图标都有 3 个方案可比较 | 用用户动作表达价值 |
| 步骤 3 说明 | Get three distinct options for every icon, making it easy to compare them and choose the best result. / 每个图标都会生成 3 种不同方案…… | Review three visual variations, retry individual failures, and download the results you choose. / 查看 3 个视觉方案，单独重试失败项，并下载选中的结果。 | 补充真实的重试与下载能力 |

### 4.2 价格与结账

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| H1 | Pay for the generations you need / 按你的实际生成需求购买 | Buy credits when you need them / 按需购买点数 | 自然、直接，并与产品计费单位一致 |
| 说明 | One icon subject includes three variants and costs one credit. No subscription required. / 每个图标主体包含 3 个方案…… | 1 credit generates 3 options for one icon subject. Credits are sold in one-time packs, with no subscription. / 1 点可为 1 个图标主体生成 3 个方案。点数按包一次性购买，无需订阅。 | 把“无订阅”和购买方式说完整 |
| 套餐 CTA | Choose pack / 选择点数包 | Buy 30 credits; Buy 75 credits; Buy 180 credits / 购买 30 点；购买 75 点；购买 180 点 | CTA 直接说明结果 |
| 结账标题 | Confirm purchase / 确认充值 | Review your credit pack / 确认点数包 | “充值”可能暗示余额充值，实际为购买套餐 |
| 结账说明 | 1 credit generates 3 variants for 1 subject / 1 点可生成 1 个主体的 3 个方案 | 1 credit creates 3 options for one icon subject. / 1 点可为 1 个图标主体生成 3 个方案。 | 统一“options/方案”，避免 variants 与用户术语混用 |
| 支付 CTA | Continue to secure checkout / 继续前往安全支付 | Continue to payment / 前往支付 | 不在缺少证据时使用“secure”背书 |
| 支付未接通 | Payments are not connected yet. Configure Stripe and try again. / 支付服务尚未连接，请配置 Stripe 后重试。 | Payments are temporarily unavailable. Please try again later. / 支付功能暂不可用，请稍后再试。 | 不向普通用户暴露开发配置 |
| 返回 CTA | Choose another pack / 返回选择其他点数包 | Back to credit packs / 返回点数包 | 统一、简洁 |

套餐描述建议：

| 套餐 | 现有英文 / 中文 | 建议英文 / 中文 |
| --- | --- | --- |
| Starter | For testing your first icon set / 适合测试第一套图标 | Try your first complete icon set / 适合生成并验证第一套完整图标 |
| Maker | For active product design / 适合持续进行产品设计 | For an active product or feature cycle / 适合一个持续迭代的产品或功能周期 |
| Studio | For multiple products and client projects / 适合多个产品与客户项目 | For multiple products or client projects / 适合多个产品或客户项目 |

### 4.3 登录、注册与账户恢复

| 场景 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| 登录标题 | Welcome back / 欢迎回来 | Welcome back / 欢迎回来 | 保留，简洁自然 |
| 登录说明 | Sign in to create. / 登录后开始创作。或 Sign in and start creating your icons. / 登录并开始生成图标。 | Sign in to create and manage your icon sets. / 登录后创建和管理你的图标。 | 合并重复版本，并覆盖历史任务价值 |
| 登录按钮 | Continue to Bamboo IconGen / 继续进入 Bamboo IconGen | Sign in / 登录 | 按钮只描述当前动作 |
| 注册标题 | Create an account / 创建账户 | Create your account / 创建账户 | 英文更自然，中文保留 |
| 注册说明 | 当前多处存在“start creating”式重复 | Save your icon sets, track progress, and return to past generations. / 保存图标、查看进度，并随时回看历史生成记录。 | 说明注册的实际收益 |
| 邮箱验证完成 | Your secure sign-in session is ready. We are taking you to your Bamboo IconGen workspace now. / 安全登录会话已准备完成…… | Your email is verified. You can now open your workspace. / 邮箱验证完成，现在可以进入工作空间。 | 删除内部“session”概念和不必要的“secure” |
| 验证 CTA | Enter workspace / 进入工作空间 | Open workspace / 打开工作空间 | 更自然，保持结果导向 |
| 忘记密码成功 | If an account exists, a password reset email has been sent. / 若账户存在…… | If an account matches that email, we sent password reset instructions. / 如果该邮箱对应一个账户，我们已发送密码重置说明。 | 保留防枚举安全语义，同时更清楚 |
| 重置链接无效 | Open a valid password reset link first. / 请先打开有效的密码重置链接。 | This reset link is invalid or has expired. Request a new link to continue. / 此重置链接无效或已过期，请重新获取链接。 | 给出恢复动作 |

### 4.4 创建页：页面介绍

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| Eyebrow | Icon design / 图标设计 | Create icon set / 创建图标集 | 与页面任务一致 |
| H1 | Create the UI icon library you actually need / 生成一套真正符合你实际需求的 UI 图标库 | Build your UI icon set / 创建你的 UI 图标集 | 登录后的任务页不需重复营销口号 |
| 说明 | Describe multiple icon needs, define color, background and visual style, then generate a consistent set and choose the strongest result for each icon. / 输入多个图标需求…… | Add one icon subject at a time, apply shared settings, and generate three options for each. / 逐个添加图标主体，统一设置规格，自动为每个主体生成 3 种方案。 | 与真实输入模式一致；统一 best/strongest/最合适 |

### 4.5 创建页：设置与操作

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| 用途说明 | Choose how the icon will be used to show only the relevant design settings. / 选择图标在产品中的用途，仅显示对应的设计设置。 | Choose where the icons will be used. We will show the settings that apply. / 选择图标的使用场景，页面将显示对应设置。 | 更口语、更直接 |
| Interaction 标题 | App interaction icons / App 交互图标 | In-app UI icons / App 内交互图标 | 英文更常用，中文明确“App 内” |
| Interaction 说明 | For in-app navigation, actions, states, and feature entry points such as search, back, add, and delete. / 用于 App 内的导航…… | For navigation and actions inside your app, such as home, search, back, add, and delete. / 用于 App 内的导航和操作，例如首页、搜索、返回、新增和删除。 | 精简分类并补全常见示例 |
| App icon 说明 | For home screens, launchers, and app stores, with emphasis on brand recognition and a polished standalone visual. / 用于手机桌面…… | For home screens, launchers, and app stores. Choose one standalone visual style with strong brand recognition. / 用于手机桌面、启动器和应用商店，重点呈现单枚图标的品牌辨识度。 | 拆短英文，中文删除空泛“高质量” |
| 批处理模块标题 | Batch icon specifications and preview / 图标批处理规格设置和预览 | Icon settings and live preview / 图标设置与实时预览 | 删除工程化“batch specifications” |
| App 风格说明 | Choose a visual style that represents the app as a whole. / 通过预览选择能够代表整个 App 的统一视觉风格。 | Choose one style for the app icon. / 为 App 图标选择一种视觉风格。 | 操作更明确 |
| 主体说明 | Each input creates one icon. Add more as needed. / 每个输入项对应一个图标，可继续添加。 | Describe one icon per field. Add another field for each additional icon. / 每个输入项描述一个图标；需要更多图标时继续添加。 | 进一步避免一框多主体 |
| 添加按钮 | Add icon subject / 添加图标主体 | Add another icon / 再添加一个图标 | 用户语言替代数据模型术语 |
| 删除无障碍标签 | Remove icon subject 1 / 删除图标主体 1 | Remove icon 1 / 删除第 1 个图标 | 简洁自然 |
| 尺寸标题 | Reference sizes / 参考尺寸 | Output sizes / 输出尺寸 | 实际会生成对应尺寸资产，“参考”容易误解 |
| 尺寸说明 | Choose multiple sizes, up to 3. Selected 3/3. / 支持多选，最多选择 3 种…… | Choose up to 3 output sizes. 3 of 3 selected. / 最多选择 3 种输出尺寸，当前已选 3/3。 | 更准确，并保留动态计数 |
| 提交中 | Creating task… / 正在创建任务… | Starting generation… / 正在开始生成… | 不暴露“任务”实现概念 |
| 提交按钮 | Generate icons / 生成图标 | Generate 3 options per icon / 为每个图标生成 3 个方案 | 点击结果更明确；需确认移动端按钮长度 |
| 无主体错误 | Describe at least one icon subject. / 请至少填写一个图标主体的描述。 | Describe at least one icon before generating. / 请至少填写一个图标需求再生成。 | 明确动作发生时机 |
| 格式错误 | Some icon subjects are incomplete. Check the entered content. / 部分图标主体格式不完整…… | Some icon descriptions are incomplete. Review each field and try again. / 部分图标描述不完整，请检查每个输入项后重试。 | 给出恢复路径 |
| 设置加载失败 | Design settings failed to load. Refresh the page. / 设计设置加载失败，请刷新页面。 | Icon settings could not load. Refresh the page to try again. / 图标设置加载失败，请刷新页面重试。 | 主语更贴近用户界面 |
| 尺寸上限 | Choose up to 3 reference sizes. / 参考尺寸最多选择 3 种。 | Choose up to 3 output sizes. / 最多选择 3 种输出尺寸。 | 与标题统一 |

### 4.6 结果页与历史任务

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| 页面标题 | 4 icons · 3 variants each / 4 个图标 · 每个 3 种备选方案 | 4 icons · 3 options each / 4 个图标 · 每个 3 个方案 | 用户界面统一用 options/方案 |
| Queued | Waiting to start / 等待开始 | In queue / 排队等待生成 | 更准确地表达队列状态 |
| Compiling | Preparing the design brief / 正在整理设计要求 | Preparing icon instructions / 正在整理图标要求 | 避免“brief”造成专业门槛 |
| Processing assets | Processing icon files / 正在处理图标文件 | Preparing output sizes / 正在准备输出尺寸 | 说明用户能理解的结果 |
| Saving | Saving results / 正在保存结果 | Saving your icons / 正在保存图标 | 更具体 |
| 当前主体 | Working on: Home / 正在处理：首页 | Generating: Home / 正在生成：首页 | 与阶段动作一致 |
| 完成计数 | 3 / 12 variants complete / 已完成 3 / 12 个方案 | 3 of 12 options ready / 12 个方案中已完成 3 个 | 英文更自然，中文读序更顺 |
| 失败状态 | Failed / 生成失败 | Could not generate / 生成失败 | 英文避免像终局标签，可与重试动作衔接 |
| 重试按钮 | Regenerate / 重新生成 | Try this option again / 重新生成此方案 | 明确只重试一个方案 |
| 无可下载尺寸 | No downloadable size is ready. | This option is not ready to download yet. / 此方案暂未准备好可下载文件。 | 当前英文会直接显示给用户，应双语化并更自然 |
| 未选择下载 | Select at least one icon variant first. / 请先选择至少一个图标方案。 | Select at least one option to download. / 请至少选择一个要下载的方案。 | 说明选择目的 |
| 下载按钮 | Download selected ZIP / 打包下载选中图标 | Download selected icons / 下载选中图标 | ZIP 是交付格式，不必作为主动作名称 |
| 打包中 | Creating ZIP… / 正在打包… | Preparing download… / 正在准备下载… | 以用户结果为中心 |
| 历史页说明 | Every completed, processing or attention-required generation stays here. / 所有已完成、处理中或需要注意的生成任务都会保存在这里。 | Find completed, in-progress, and failed icon sets here. / 在这里查看已完成、生成中和失败的图标集。 | 修复生硬“attention-required generation” |
| 空状态 | No generation jobs yet / 还没有真实的生成任务 | No icon sets yet / 还没有图标集 | 删除“真实”和内部“job”术语 |
| 空状态 CTA | Create icons / 创建图标 | Create your first icon set / 创建第一套图标 | 结果更明确 |
| 列表兜底名 | Generation job / 生成任务 | Untitled icon set / 未命名图标集 | 用户语言替代系统语言 |

### 4.7 账户与删除账户

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| 账户说明 | 现有 accountCopy | Manage your profile, credit balance, and account security. / 管理个人资料、点数余额和账户安全。 | 明确页面范围 |
| 点数规则 | 现有 oneCreditRule | 1 credit generates 3 options for one icon subject. / 1 点可为 1 个图标主体生成 3 个方案。 | 与价格页统一 |
| 充值 CTA | Top up / 充值 | Buy credits / 购买点数 | 对应实际购买行为 |
| 加载失败 | We could not load your account. / 无法加载账户 | Your account details could not load. Refresh the page to try again. / 账户信息加载失败，请刷新页面重试。 | 提供恢复动作 |
| 保存失败 | We could not update your profile. / 无法保存个人资料 | Your profile was not saved. Check your connection and try again. / 个人资料未保存，请检查网络后重试。 | 说明结果与下一步 |
| 删除说明 | 现有 deleteGrace | Schedule account deletion with a 30-day grace period. You can cancel before the deletion date. / 提交后账户将在 30 天宽限期结束时删除；删除日期前可随时取消。 | 把关键期限前置 |
| 确认输入 | Type DELETE / 输入 DELETE | Type DELETE to confirm / 输入 DELETE 以确认 | 说明输入目的 |
| 密码标签 | Confirm password for this action / 输入密码确认操作 | Enter your password / 输入账户密码 | 更简洁，操作上下文已清楚 |
| 删除 CTA | Schedule deletion / 安排删除 | Schedule account deletion / 安排删除账户 | 明确对象 |
| 活跃生成阻塞 | Wait for active icon generations to finish. | An icon set is still generating. Wait for it to finish, then try again. / 仍有图标正在生成，请等待完成后重试。 | 解释原因和下一步 |

### 4.8 管理后台

| 元素 | 现有英文 / 中文 | 建议英文 / 中文 | 理由 |
| --- | --- | --- | --- |
| 页面说明 | A protected surface for user, generation, payment, credit-ledger, and audit-log investigations. / 对用户、生成、支付、点数账本和审计日志进行排查的受保护界面。 | Review users, icon generation, payments, and credit activity. / 查看用户、图标生成、支付和点数记录。 | 面向运营任务，不强调“protected surface”与内部表名 |
| 卡片占位 | Search and operational actions will be added with role checks and audit logging. / 搜索与运营操作将在角色校验和审计日志完善后加入。 | This section is not available yet. / 此模块暂未开放。 | 当前界面只需准确说明状态；实现计划留在开发文档 |

### 4.9 元数据与浏览器标题

| 位置 | 现有英文 | 建议英文 | 理由 |
| --- | --- | --- | --- |
| Site description | Generate consistent UI icon sets with three variants per icon. | Create consistent UI icon sets with three options for every icon. | “Create”更主动，术语统一 |
| Root meta description | Generate production-ready UI icon sets with three variants per icon. | Create consistent UI icon PNGs, with three options for every icon. | 删除难以证明的“production-ready”，补充真实格式 |
| 结果页 title | Generation results | Icon set results | 用户语言替代系统流程语言 |

## 5. 系统错误文案规范

当前部分 API 英文错误会直接在前端展示。建议后续增加错误码到本地化文案的映射层，不直接显示服务端英文 `message`。

### 推荐结构

1. **标题或首句：** 当前操作未完成。
2. **影响：** 已填写内容、已有结果或点数是否受影响。
3. **恢复动作：** 刷新、返回修改、稍后重试、重新登录或联系支持。
4. **错误码：** 仅在需要客服排查时以次要文本显示，不替代人类可读说明。

### 高优先级错误对照

| 错误码 | 现有英文 | 建议英文 / 中文 |
| --- | --- | --- |
| `SETTINGS_VERSION_EXPIRED` | The design settings have changed. Refresh and review your choices. | Icon settings were updated. Refresh the page, review your choices, and generate again. / 图标设置已更新，请刷新页面、确认选项后重新生成。 |
| `ACTIVE_JOB_LIMIT_REACHED` | A generation task is already running. | Another icon set is still generating. Wait for it to finish before starting a new one. / 另一套图标仍在生成，请等待完成后再开始新任务。 |
| `GENERATION_CREATE_FAILED` | We could not create the generation task. | Generation could not start. Your settings are still on this page; try again. / 未能开始生成，当前设置仍保留在页面上，请重试。 |
| `GENERATION_DATABASE_MIGRATION_REQUIRED` | Generation is temporarily unavailable because the database generation function has not been deployed. | Generation is temporarily unavailable. Please try again later. / 生成功能暂不可用，请稍后再试。 |
| `DOWNLOAD_NOT_READY` | The selected size is not ready for every result. | Some selected icons are not ready in this size. Wait for processing to finish or select fewer icons. / 部分选中图标的该尺寸尚未准备好，请等待处理完成或减少选择。 |
| `DOWNLOAD_CREATE_FAILED` | We could not create the ZIP download. | The download could not be prepared. Your icons are safe; try again. / 下载文件准备失败，图标结果不会丢失，请重试。 |
| `GENERATION_VARIANT_RETRY_FAILED` | We could not regenerate this icon variant. | This option could not restart. Try again in a moment. / 此方案未能重新开始生成，请稍后重试。 |
| `AUTH_SERVICE_UNAVAILABLE` | Authentication is not configured. | Sign-in is temporarily unavailable. Please try again later. / 登录功能暂不可用，请稍后再试。 |
| `AUTHORIZATION_FAILED` | We could not verify this account. | Your session could not be verified. Sign in again to continue. / 无法验证当前登录状态，请重新登录后继续。 |
| `ACCOUNT_LOAD_FAILED` | We could not load your account. | Your account details could not load. Refresh the page to try again. / 账户信息加载失败，请刷新页面重试。 |

## 6. 完整前端文本覆盖清单

本节用于确认审计范围。“保留”表示语义清楚、符合当前功能，不建议仅为变化而改写；“优化”对应第 4、5 节；“待产品确认”表示需要业务事实后才能定稿。

| 页面或组件 | 已覆盖文本类型 | 结论 |
| --- | --- | --- |
| 全局导航与页头 | Home、Pricing、My Icons、Sign in、Create icons、Account、Credits、Add credits、中英文切换、退出 | 基础标签保留；“Add credits”建议统一为“Buy credits / 购买点数” |
| 首页 | Eyebrow、H1、说明、主 CTA、3 个能力步骤 | 优化 |
| 价格页 | 页面标题、点数规则、3 个套餐名、描述、价格、CTA | 优化；套餐名是否中文化待产品确认 |
| 登录页 | 标题、说明、邮箱、密码、忘记密码、提交、注册入口、服务不可用与失败状态 | 说明和按钮优化；字段标签保留 |
| 注册页 | 标题、说明、邮箱、密码、确认密码、条款、提交、登录入口、校验错误 | 价值说明优化；字段与校验大部分保留 |
| 忘记密码 | 标题、说明、邮箱、发送状态、返回登录 | 成功与失效状态优化 |
| 重置密码 | 标题、说明、新密码、确认密码、提交、成功和失效状态 | 错误恢复路径优化 |
| 邮箱验证完成 | 标题、说明、跳转状态、CTA | 优化，删除 session 技术词 |
| 创建页页头 | Eyebrow、H1、说明 | 优化 |
| 图标用途 | 标题、说明、App 交互图标、App 图标及两段用途描述 | 优化 |
| 交互图标设置 | 模块标题、实时预览、图形结构、线性、面性、主体颜色、纯色、多色、颜色值、自动配色说明 | 模块标题优化；控件标签保留 |
| 背景设置 | 透明、单色、渐变、圆角、圆形、方块、圆角百分比、起始色、终点色、7 种渐变方向 | 标签清楚，保留 |
| App 图标风格 | 模块标题、说明、风格预设、加载状态、风格名称与描述、图片 alt | 模块说明优化；风格描述属于设计规格，另行维护 |
| 图标主体 | 标题、说明、计数、输入无障碍名、删除、添加按钮 | 优化 |
| 输出尺寸 | 标题、说明、动态计数、尺寸按钮、超限提示 | “参考尺寸”统一为“输出尺寸” |
| 生成提交 | 提交按钮、提交中、无主体、格式不完整、设置加载失败、任务创建失败 | 优化 |
| 我的图标 | Eyebrow、H1、说明、空状态、CTA、任务兜底名、主体计数、状态标签 | 优化 |
| 结果页 | 页面标题、阶段、进度、当前主体、更新时间、方案名、方案状态、重试、选择、全选、下载、错误 | 优化；完成后隐藏更新时间的现状保留 |
| 账户页 | 页面标题、说明、点数、资料、安全、邮箱验证、保存及加载状态 | 说明、点数 CTA、错误优化 |
| 删除账户 | 返回、危险区域、宽限期、导出、待删除状态、剩余天数、取消、确认字段、状态反馈 | 高风险说明优化；需产品确认删除后数据保留政策 |
| 结账 | 无效套餐、确认标题、点数规则、支付 CTA、返回、支付不可用 | 优化 |
| 管理后台 | 页面标题、说明、3 个模块名、占位状态 | 优化 |
| Metadata | 站点描述、首页/注册/我的图标/结果页标题 | 优化 |
| API 回显错误 | 登录、账户、生成、下载、重试、支付相关 message | 建立本地化映射层后优化 |

## 7. 建议术语表

| 概念 | 英文统一用词 | 中文统一用词 | 避免 |
| --- | --- | --- | --- |
| 一套生成内容 | icon set | 图标集 / 一套图标 | library（除营销语境）、generation job / 生成任务 |
| 用户输入的单个对象 | icon subject（说明性文案可用 icon） | 图标主体（说明性文案可用图标） | requirement / 需求（容易理解为长文本） |
| 同一主体的 3 个结果 | option | 方案 | variant 与 option 混用、备选方案冗余 |
| 生成像素尺寸 | output size | 输出尺寸 | reference size / 参考尺寸 |
| App 内功能图标 | in-app UI icons | App 内交互图标 | App interaction icons（可作为数据枚举，不建议做主标题） |
| 点数 | credit | 点 | token、quota、generation |
| 创建中的后台记录 | generation（用户文案） | 生成（用户文案） | task/job，除非是管理员或日志界面 |
| 多选下载 | download selected icons | 下载选中图标 | ZIP 作为主要价值描述 |

## 8. Proofreader 校对记录

本轮在文案策略改写后进行了第二遍语言校对，重点检查语法、拼写、标点、清晰度和双语意图一致性。

### 已统一

- 英文界面统一使用 sentence case。
- 中文全句使用全角标点；按钮和短标签不强制加句号。
- 英文用户文案避免使用 em dash，改用句号或逗号。
- 数量表达统一为“3 options for every icon / 每个图标 3 个方案”。
- 删除“truly”“actually”“everything”“production-ready”等无法验证或作用有限的修饰。
- 错误状态优先使用主动、明确的恢复动作，避免连续使用“We could not…”。
- 保留安全场景所需的模糊表达，例如忘记密码接口不确认邮箱是否已注册。

### 需要业务确认后再定稿

1. 点数包的中文名称是否继续使用“入门 / 创作者 / 工作室”，还是英文品牌名统一不翻译。
2. 支付服务上线时间与退款说明；当前不能写“安全支付”或具体支付保障承诺。
3. 账户删除后，生成图片、支付记录和审计记录的具体保留政策。
4. “可直接用于生产”是否有正式质量验收标准；确认前不使用 production-ready。
5. 是否提供客服或反馈入口；若提供，应在不可恢复错误中增加联系路径和错误码。

## 9. 落地建议

### 阶段 1：建立统一文案层

- 把创建页、结果页、价格页仍在组件中硬编码的中英文文案迁入统一 locale 字典。
- 为 API 错误码建立 `code -> en/zh message + recovery action` 映射，前端不直接展示服务端英文。
- 加入术语级测试，防止 `Generation job`、`reference sizes` 等旧词重新出现。

### 阶段 2：按风险应用文案

1. 先应用 P0 错误、支付、删除账户与结果页状态文案。
2. 再应用首页、价格、登录和创建页主文案。
3. 最后统一账户、后台和 Metadata。

### 阶段 3：验证

- 英文和中文分别走一遍：首页 → 注册/登录 → 创建 → 结果 → 下载。
- 在 320 px、768 px 和桌面宽度检查长按钮、错误信息和中英文换行。
- 用失败任务、部分成功任务、无点数、支付不可用、删除待处理等状态做界面自测。
- 观察首页主 CTA 点击率、创建页校验失败率和生成提交完成率，再决定是否继续压缩文案。

## 10. 本次文档的边界

- 本文是完整前端文案审计与改写基线，核心页面、公共双语字典、用户可见 API 错误和 Metadata 已按此方案落地。
- 风格预设的名称、风格特征描述与 ImageGen 提示词属于设计规格，不在本轮营销和 UI 文案改写范围内。
- 法律条款、隐私政策、退款政策需由业务或法律负责人提供事实依据后单独校对。
- 文档中的建议不会改变现有功能、计费规则或生成协议。
