# esdesign · EASY ICON

## 项目介绍

EASY ICON 是一个本地运行的 AI 图标创作与管理工具。用文字描述你需要的图标，即可为同一主体生成六种 SVG 风格；也可以从素材库查找已有图标，预览、调整并下载，用于 App、网站或产品原型。

从需求输入、图标生成，到画布整理、项目保存、收藏回收和多格式下载，都可以在同一个工作台完成。项目数据保存在本机 SQLite 中，单用户使用无需注册登录。

代码及本仓库自有图标、图片和文档采用 [MIT License](LICENSE)，允许使用、修改、再分发和商用，须保留版权及许可声明。第三方依赖和引用资产保留各自许可证，详见 [第三方说明](THIRD_PARTY_NOTICES.md)。

## 功能介绍

- **文字生成图标**：支持单主体和批量生成，每个主体提供 Linear、Outline、Bold、Broken、Bulk、Twotone 六种 SVG；画布按主体展示，默认线性。
- **画布操作**：平移、缩放、单图聚焦、自动整理及拖动对齐辅助，方便查看和组织图标集。
- **项目管理**：创建、关联和编辑项目，保存生成结果、设置和画布位置。
- **收藏与回收**：分别管理单图和整组，支持多选下载、取消收藏、回收恢复和永久删除。
- **预览与下载**：在详情中切换风格、查看和复制代码，调整颜色和尺寸，下载 SVG / PNG / WebP，栅格输出最高 1024px。
- **代码导出**：支持 SVG、Vue、React、HTML、Svelte、Web Components 六种代码格式，可实时预览并一键复制，用于不同前端项目。
- **素材库**：按分类、关键词和六种风格筛选已有图标，打开详情、收藏和下载；素材库收藏与项目收藏独立。
- **界面与本地数据**：支持中英文、深浅主题和本地个人资料，数据保存在本机，无需登录。

本地模式不需要 Docker、Supabase 或邮箱服务。**图标生成仍调用自行配置的模型接口，可能收费并受上游额度限制。**

## 功能截图

以下为实际页面截图，不是设计稿。画布、收藏和回收示例来自本地演示数据；六风格生成截图来自简化模式的真实模型调用。

### 图标生成与画布

输入需求、管理项目，在画布中查看和整理生成结果。

![图标生成工作台](docs/screenshots/workspace-dark.png)

### 六风格预览与代码

同一主体可切换六种风格，并导出 SVG、Vue、React、HTML、Svelte 或 Web Components 代码。下图为实际生成的收藏五角星。

![实际生成的六风格详情](docs/screenshots/local-generation-verified.jpg)

### 收藏与回收

按图组或单图管理收藏、下载和回收恢复。

![单图收藏](docs/screenshots/favorites.png)
![单图回收](docs/screenshots/recycle.png)

### 素材库

按分类和风格浏览、搜索图标，深浅主题均可使用。

![素材库深色界面](docs/screenshots/library-list.jpg)
![素材库浅色界面](docs/screenshots/library-list-light.jpg)

打开图标详情，可切换六种风格、预览代码、调整颜色和尺寸并下载。

![素材库图标详情](docs/screenshots/library-detail.jpg)

[查看全部功能截图](docs/screenshots/README.md)

## 使用与文档

首次安装请从[完整安装教程](docs/guides/simple-local.md)开始：包含 Node.js 安装、获取源码、模型配置、首次生成、日常运行、更新、备份恢复和排障。下面是已具备运行环境时的简版步骤。

简化本地模式需要 Node.js 24+、npm 和一个支持 JSON / 图片输入的模型接口。不需要 Docker、Supabase 或邮箱服务。

```bash
npm ci
cp apps/web/.env.example apps/web/.env.local
```

填写模型配置后：

```bash
npm run dev:local
```

网站：http://127.0.0.1:3000/create 。无需登录；数据库首次启动自动建立于 `.local/easy-icon/workspace.sqlite`。素材库文件随项目提供。

[简化本地部署与备份](docs/guides/simple-local.md)。旧 Supabase 配置和数据保留，不自动导入或删除。

- [架构、生成链路、部署及工具配置](docs/open-source-guide.md)
- [功能截图](docs/screenshots/README.md)
- [本地运行与数据边界](docs/guides/local-self-use.md)
- [研发准则](docs/project/development-principles.md)

## 测试

```bash
npm run typecheck
npm run lint
npm test
node --test scripts/local-commercial-cleanup.test.mjs
node --test scripts/local-database.test.mjs
node scripts/test-simple-local.mjs
```

最后一项只接受 SQLite 本地用户，清理自己的临时项目，使用测试 SVG，不调用付费模型。实际生成质量需在前端另行验收。

## 当前限制与发布条件

- 技术检查通过不等于视觉通过；pending / rework-required 不代表正式验收通过。
- 上游授权、模型映射、限流可能导致失败，不能保证批次一次全部成功。
- 历史图片 Worker、商业迁移和账本数据保留为兼容资料，旧收费图片任务入口已停用。
- 简化模式是单用户，不使用注册、登录和 OAuth；旧账户与文件不会自动迁移。历史 Supabase 模式仍可通过原启动命令运行。
- 网站只绑定本机；公网部署需额外配置 HTTPS、邮件、安全和备份。
- 干净机器及 Windows / Linux 安装尚未全面验证；旧收费流程测试与停用接口存在不一致，不能将当前版本视为全量测试通过。
