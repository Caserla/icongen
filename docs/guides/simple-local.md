# 本地安装与使用教程

EASY ICON 在你的电脑上运行，使用 SQLite 保存项目和图标。安装后可以生成六风格 SVG、管理收藏和回收、浏览素材库、下载 SVG / PNG / WebP。

本教程使用单用户本地模式：**无需 Docker、Supabase、注册账户或验证邮箱**。生成仍需要你自己的模型接口，不是离线生图工具。

## 一、安装前准备

| 准备项 | 要求 |
| --- | --- |
| Node.js | 推荐安装 24.x LTS；本地启动器要求 24 或更高版本 |
| npm | 随 Node.js 安装，用于安装依赖及启动网站 |
| 项目源码 | 获取包含 `dev:local`、`build:local`、`start:local` 命令的完整版本 |
| 模型接口 | 兼容 Chat Completions，支持 JSON 输出和图片输入 |
| 网络 | 首次安装需要下载 npm 依赖；生成需要连接模型服务 |
| Git | 可选，使用 Git 下载和更新源码时需要 |

当前已在 macOS + Node.js 24 的本地环境验证。Windows 和 Linux 的操作命令附在下文，但尚未在干净设备上完成逐系统安装验证。

### 安装 Node.js

前往 [Node.js 官方下载页](https://nodejs.org/en/download)，选择 **24.x LTS** 和对应系统安装包。

- macOS：根据电脑选择 Apple Silicon（ARM64）或 Intel（x64），运行安装程序。
- Windows：通常选择 x64 安装程序，保留 npm 和 PATH 选项。
- Linux：按官方页面为你的发行版提供的方法安装 24.x，不要直接使用可能过旧的系统默认版本。

安装完成后，新开一个终端，执行：

```bash
node --version
npm --version
```

第一条应显示 `v24.x.x` 或更高版本，第二条应显示 npm 版本号。如果提示“找不到命令”，先关闭并重新打开终端，再检查 Node.js 是否安装成功。

### 获取源码

方式 A：下载项目 ZIP，解压到普通可写目录。不要只下载 `apps/web`；根目录的 `packages` 和锁文件也必须保留。

方式 B：有仓库访问权限时使用 Git：

```bash
git clone https://github.com/Caserla/icongen.git
cd icongen
```

如果仓库无法访问，先取得访问权限或使用提供的源码包。不要把“仓库存在”当作“已经公开发布”；下载的版本应包含本教程所列本地命令。

以下命令均在**仓库根目录**执行，不是在 `apps/web` 内。该目录应同时有 `package.json`、`package-lock.json`、`apps`、`packages`。

已有源码时，先进入对应目录，例如：

```bash
cd /你的路径/icongen
```

Windows 可在项目文件夹内右键“在终端中打开”，或在 PowerShell 中使用 `cd "D:\你的路径\icongen"`。

## 二、安装项目依赖

```bash
npm ci
```

等待命令完成并回到输入状态。这一步安装 Next.js、React、SVG 检查、图片导出等依赖，不需要启动数据库容器。

不要使用 `sudo npm ci`，不要为解决安装报错而随意删除锁文件。安装失败先看本教程的排障表。

## 三、配置模型服务

### 1. 创建配置文件

首次安装且没有 `apps/web/.env.local` 时，复制模板。

macOS / Linux：

```bash
cp apps/web/.env.example apps/web/.env.local
```

Windows PowerShell：

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

**已有 `.env.local` 时不要再次复制覆盖。** 用文本编辑器打开 `apps/web/.env.local`，不要把它保存成 `.env.local.txt`。

### 2. 填写必需配置

```dotenv
APP_ENV=development
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000

IMAGE_PROVIDER_BASE_URL=http://127.0.0.1:8081/v1
IMAGE_PROVIDER_API_KEY=替换为你自己的模型接口密钥
ICON_PLANNER_MODEL=替换为实际可调用的模型ID
ICON_SVG_MODEL=替换为实际可调用的模型ID
```

上面的密钥和模型 ID 是占位说明，必须替换，不能原样运行生成。模板中的 Supabase 变量在本地模式下无需填写；不要把模型密钥写进任何 `NEXT_PUBLIC_` 变量。

| 参数 | 如何填写 |
| --- | --- |
| IMAGE_PROVIDER_BASE_URL | 接口根地址。应用会在末尾加 `/chat/completions`；若服务要求 `/v1/chat/completions`，这里填到 `/v1` 即可 |
| IMAGE_PROVIDER_API_KEY | 该接口发放的 API Key，不是网页登录密码、上游账户密码或 Supabase Key |
| ICON_PLANNER_MODEL | 需求解析模型的真实 ID，要求 JSON 输出能力 |
| ICON_SVG_MODEL | SVG 绘制和视觉复核模型的真实 ID，要求图片输入能力 |
| NEXT_PUBLIC_APP_URL | 保持与浏览器实际访问地址及端口一致 |

两个模型可以使用同一个 ID，也可以分别配置。模型名以你的服务实际支持为准，不能仅因为名称出现在模型列表中就认为可以调用。

### 3. 选择直连或网关

**使用自己的兼容模型服务**：填服务商提供的根地址、密钥和模型 ID，不需要安装 sub2api。

**使用本机 sub2api**：先启动你自己的 sub2api，确认它监听的端口；默认示例使用 `http://127.0.0.1:8081/v1`。在 sub2api 中配置可用上游账户、API Key、分组权限及模型映射，再将它的接口密钥填入 EASY ICON。

sub2api 是独立可选工具，不会被 `npm ci` 自动安装，也不会被网站自动启动。管理后台能打开，不等于账户授权、额度和模型调用都正常。

注意：

- 不要把根地址写成管理后台地址、完整 `/chat/completions` 地址或只支持 Responses 的接口。
- `127.0.0.1` 指当前电脑；网关在另一台机器时，应填写真实可访问地址。
- 云端接口应使用 HTTPS；模型服务可能收费或消耗额度。
- 输入描述、相关项目上下文、参考图及视觉复核图会发送到配置的模型服务，不要输入机密内容。
- 密钥仅保存在 `.env.local`，不要发到聊天、截图、Git 或公共日志。

## 四、第一次启动

先用开发模式验证配置：

```bash
npm run dev:local
```

看到 `Ready` 和本地网址后，打开：

[http://127.0.0.1:3000/create](http://127.0.0.1:3000/create)

启动时会自动建立 SQLite 数据库，不需要手动建库或运行 SQL。页面直接进入图标生成，无需登录。未填写模型配置时可以打开工作台，但不能正常生成。

终端需保持运行。停止网站时回到该终端按 `Ctrl+C`；再次运行启动命令即可恢复。

不要用 `npm run dev` 代替 `npm run dev:local`：前者是保留的旧模式，会走不同的认证与数据路径。

## 五、验证第一次生成

1. 在顶部“新增或关联项目”输入项目名称，例如“我的 App”。
2. 按回车或点击新增按钮，填写项目简介，点击“创建并关联”。
3. 在底部描述框输入：`生成一个常用 App 收藏图标，以五角星为主体，线条圆润均匀。`
4. 点击发送，等待需求解析、绘制和复核。不要在生成中刷新页面或重复提交。
5. 生成后，画布按主体展示图标；点击选中，再点击下载图标打开详情。
6. 在详情中切换 Linear、Outline、Bold、Broken、Bulk、Twotone 六种风格，查看代码并选择下载格式。
7. 完成后刷新页面，确认项目和结果仍保留。

没有关联项目时，页面会提示先新增或关联项目，这不是模型故障。六风格绘制与复核需要多次模型调用，可能等待数分钟；可用性和耗时取决于上游服务。出现“继续复核”说明视觉复核尚未完成，不能当作完全通过。

素材库可以直接打开 [http://127.0.0.1:3000/library](http://127.0.0.1:3000/library)，无需先调用模型。

## 六、日常使用：构建后运行

配置验证完成后，可以使用非开发模式。先停止开发服务，再执行：

```bash
npm run build:local
```

构建成功后：

```bash
npm run start:local
```

访问地址不变。以后日常打开网站只需进入仓库运行 `npm run start:local`；修改源码、安装新版本或更改 `NEXT_PUBLIC_` 配置后，应重新构建。

| 命令 | 用途 |
| --- | --- |
| npm ci | 初次安装或按锁文件重新安装依赖 |
| npm run dev:local | 开发运行，修改源码后自动更新 |
| npm run build:local | 编译本地版本，不会持续启动网站 |
| npm run start:local | 运行已构建的本地版本 |
| Ctrl+C | 停止当前终端中的网站服务 |

不能同时运行两个网站进程争用端口。也不要用默认 `npm run start` 运行本地构建，否则会回到旧认证模式。电脑重启后网站不会自动启动，需要重新执行启动命令。

## 七、数据保存和备份

### 保存位置

默认保存在仓库根目录：

```text
icongen/
├── apps/web/.env.local          模型配置和密钥
├── .local/easy-icon/
│   ├── workspace.sqlite        项目、图标、收藏、回收等数据
│   ├── workspace.sqlite-wal    运行期间可能存在
│   └── workspace.sqlite-shm    运行期间可能存在
└── apps/web/public/library/     随源码提供的素材库文件
```

生成的六风格 SVG、坐标、设置快照和生成上下文保存在 SQLite，不依赖单独的 Storage 服务。下载文件由浏览器保存到你选择的下载位置。

可在 `.env.local` 中设置 `EASY_ICON_DATA_DIR`，使用**私有绝对路径**指定另一个数据目录。更改后须重启；改变目录不会自动搬迁数据，直接切换会显示一个新的空白工作区。

### 备份

1. 在网站终端按 `Ctrl+C`，确认服务已停止。
2. 复制**整个** `.local/easy-icon` 文件夹到备份位置，包含可能存在的 WAL / SHM 文件。
3. 将 `.env.local` 单独备份到私密位置；它含密钥，不要公开上传。
4. 重新启动网站。

macOS / Linux 示例（备份名称每次换一个，避免覆盖）：

```bash
mkdir -p .local/backups
cp -R .local/easy-icon .local/backups/easy-icon-backup-01
```

Windows 可以在文件管理器中复制整个文件夹；隐藏的 `.local` 目录也必须复制。

不要在网站运行中仅复制 `workspace.sqlite`，否则可能遗漏尚在 WAL 中的数据。

### 恢复或换电脑

1. 停止网站。
2. 先把当前数据目录移动到另一个备份目录，保留恢复前的数据。
3. 将备份的整个 `easy-icon` 目录放回 `.local/easy-icon`；若设置了 `EASY_ICON_DATA_DIR`，恢复到该路径。
4. 在新电脑安装同版本源码与 Node.js，执行 `npm ci`，填写模型配置。
5. 构建并启动，确认项目与图标恢复正常。

不要删除或覆盖唯一一份数据副本。SQLite 模式不会自动导入以前 Supabase 中的账户和图标，也不会删除它们。

## 八、更新项目

先停止网站并备份数据、私密配置。在确认没有未保存代码改动的情况下获取新版本；有本地代码修改时不要直接强制覆盖。

使用 Git 且工作区干净时：

```bash
git pull --ff-only
npm ci
npm run build:local
npm run start:local
```

如果使用 ZIP，解压到新目录，按上一节迁移数据与配置。不要用新模板覆盖已有 `.env.local`。遇到数据格式升级时，应先阅读该版本的迁移说明。

## 九、常见问题

| 现象 | 排查方法 |
| --- | --- |
| node / npm 找不到 | 安装 Node.js 后重新打开终端，检查 PATH |
| 要求 Node.js 24 | 升级 Node.js，并重新确认 `node --version`，不要使用另一个终端的旧版本 |
| npm ci 提示找不到 package.json | 当前目录不是仓库根目录，先进入有 apps / packages 的目录 |
| npm ci 网络或证书错误 | 检查网络、npm 配置及企业代理；不要关闭 TLS 校验解决问题 |
| Sharp 或依赖安装失败 | 确认操作系统、CPU 架构和 Node 版本匹配；不要复制别的电脑的 node_modules |
| 端口 3000 被占用 | 停止你之前启动的网站，或在 `.env.local` 设置 `PORT=3001` 和对应的 `NEXT_PUBLIC_APP_URL`；重启后按终端显示地址访问 |
| 页面打不开 | 确认终端仍在运行且显示 Ready，使用 `http://127.0.0.1:3000/create`，不要误用 HTTPS |
| 打开页面仍要求登录 | 使用了旧启动命令；停止后改用 `dev:local` 或 `build:local` + `start:local` |
| start:local 找不到生产构建 | 先执行 `npm run build:local`，确认成功后再启动 |
| 修改密钥后仍用旧配置 | 停止并重启服务；检查是否有另一个旧进程占用端口 |
| 需求解析模型配置无效 | 检查 ICON_PLANNER_MODEL 是否真实可调用，以及网关分组 / 映射是否允许该模型 |
| 401 / 403 或无可用上游账户 | 检查接口 Key、上游授权、账户状态、分组和额度；这不是 SQLite 登录问题 |
| 429 / 超时 / 部分风格失败 | 检查上游限流和额度；避免重复提交，按界面提示重试或继续复核 |
| 项目创建或保存失败 | 检查数据目录是否可写、磁盘空间和终端错误；不要删除数据库来修复 |
| 切换数据目录后项目不见了 | EASY_ICON_DATA_DIR 指向新目录；恢复原路径或在停机后复制完整数据目录 |
| 数据重启后不见了 | 确认启动的是同一源码目录、同一本地模式和同一 EASY_ICON_DATA_DIR |

排查时可以提供错误文案及脱敏截图，但不要发送 `.env.local` 全文、密钥、Cookie 或上游账户令牌。

## 十、自测与使用边界

网站运行在默认 3000 端口时，可另开终端在仓库根目录执行：

```bash
node --test scripts/local-database.test.mjs
node scripts/test-simple-local.mjs
npm run typecheck
```

数据库测试使用临时目录，接口测试使用自己的临时项目并清理，覆盖六风格保存、收藏、回收恢复和同源保护。接口测试使用 fixture SVG，不调用模型；它不能替代真实生成及视觉验收。改用其他端口时，当前接口自测脚本不能直接运行。

网站仅绑定 127.0.0.1，并检查 Host 和写请求 Origin。**该模式仅适合单用户本机使用，不能直接用于公网、多用户或局域网共享。** 不要改成监听 `0.0.0.0`、用隧道公开或绕过这些检查。

运行依赖是 Node.js、项目源码及模型接口。旧 Supabase SDK 和兼容代码保留，但简化模式不需要运行 Supabase 服务；模型网关是否使用 Docker 与网站本身是否需要 Docker 是两回事。
