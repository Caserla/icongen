# Local installation and usage guide

[简体中文](simple-local.md) | English

EASY ICON runs on your computer and stores projects and icons in SQLite. It generates six SVG styles per subject, provides a searchable icon library, manages favorites and recycled items, and downloads SVG, PNG, and WebP.

This guide covers **single-user local mode: no Docker, Supabase, account registration, or email verification is required**. Generation still needs your own model endpoint; this is not an offline generation tool.

## 1. Requirements

| Requirement | Details |
| --- | --- |
| Node.js | Recommended: 24.x LTS. Local launchers require version 24 or newer. |
| npm | Included with Node.js; installs dependencies and runs the app. |
| Complete source | Include the root lockfile, `apps`, and `packages`, not just `apps/web`. |
| Model endpoint | Compatible Chat Completions API, JSON output, and image input. |
| Network | Required for initial dependency installation and external model requests. |
| Git | Optional; needed to clone and update using Git. |

The local setup has been tested on macOS with Node.js 24. Commands for Windows and Linux are provided, but clean-machine installation on those platforms has not been fully verified.

### Install Node.js

Download **24.x LTS** from the [official Node.js download page](https://nodejs.org/en/download).

- macOS: select Apple Silicon / ARM64 or Intel / x64 to match your computer.
- Windows: usually choose the x64 installer; retain npm and PATH support.
- Linux: follow the official instructions for your distribution. Its default package may be too old.

Open a new terminal after installation:

```bash
node --version
npm --version
```

The first command should report `v24.x.x` or newer; the second should report an npm version. If either command is missing, reopen the terminal and check the installation and PATH.

### Download the source

Clone the repository:

```bash
git clone https://github.com/Caserla/icongen.git
cd icongen
```

Alternatively, use GitHub's **Code → Download ZIP**, extract the archive into a writable directory, and open a terminal there. Keep all project folders and the lockfile.

Run all commands below from the **repository root**, containing `package.json`, `package-lock.json`, `apps`, and `packages`. Do not run them from `apps/web`.

For an existing checkout:

```bash
cd /your/path/icongen
```

On Windows, open a terminal in the project folder or use PowerShell:

```powershell
cd "D:\your\path\icongen"
```

## 2. Install dependencies

```bash
npm ci
```

Wait until the command finishes. It installs the website, SVG validation, and image-export dependencies; no database containers are needed.

Do not use `sudo npm ci`, delete the lockfile casually, or copy another machine's `node_modules`. See troubleshooting below if installation fails.

## 3. Configure your model endpoint

### Create the environment file

Only if `apps/web/.env.local` does not exist, copy the template.

macOS / Linux:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Windows PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
```

**Do not overwrite an existing `.env.local`.** Open it in a text editor; make sure it is not accidentally named `.env.local.txt`.

### Required settings

```dotenv
APP_ENV=development
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000

IMAGE_PROVIDER_BASE_URL=http://127.0.0.1:8081/v1
IMAGE_PROVIDER_API_KEY=replace-with-your-api-key
ICON_PLANNER_MODEL=replace-with-an-available-model-id
ICON_SVG_MODEL=replace-with-an-available-model-id
```

Replace the API key and model placeholders before generating. Supabase settings in the template are unnecessary in local mode. Never place model credentials in a `NEXT_PUBLIC_` variable.

| Setting | What to enter |
| --- | --- |
| IMAGE_PROVIDER_BASE_URL | API root. The app appends `/chat/completions`; for `/v1/chat/completions`, enter the root ending in `/v1`. |
| IMAGE_PROVIDER_API_KEY | API key issued by that endpoint, not a website password or Supabase key. |
| ICON_PLANNER_MODEL | An actual callable model ID supporting JSON output for request parsing. |
| ICON_SVG_MODEL | An actual callable model ID supporting image input for drawing and visual review. |
| NEXT_PUBLIC_APP_URL | Match the browser's address and port. |

You may use the same model ID for both stages. A model appearing in a list does not prove that your account or API-key group can call it.

### Direct provider or sub2api

**Direct compatible provider:** enter its endpoint root, API key, and supported model IDs. sub2api is not required.

**Local sub2api gateway:** start your separately configured gateway and verify its port. The example uses `http://127.0.0.1:8081/v1`. Configure a valid upstream account, API key, group access, quota, and model routing in sub2api; use the gateway's API key in EASY ICON.

sub2api is not installed by `npm ci` and is not started by this app. Access to its admin dashboard does not prove upstream authorization or model availability.

- Do not use a management-dashboard URL, a full `/chat/completions` URL, or an endpoint that only supports the Responses API.
- `127.0.0.1` means this computer. For a remote gateway, use its reachable address.
- Use HTTPS for remote endpoints. Model calls may incur charges or consume quota.
- Relevant prompts, project context, reference images, and review renders are sent to your endpoint. Avoid confidential input.
- Keep credentials in `.env.local`; never share them in chat, screenshots, Git, or public logs.

## 4. Start the app for the first time

Use development mode to check the configuration:

```bash
npm run dev:local
```

Once the terminal reports `Ready`, open [http://127.0.0.1:3000/create](http://127.0.0.1:3000/create).

SQLite initializes automatically. No SQL import or account registration is needed. The workspace can open without model configuration, but generation will not work until the endpoint is configured.

Keep the terminal running. Press `Ctrl+C` there to stop the app, then run the command again to restart it.

Do not substitute `npm run dev`: that command uses the retained legacy authentication and storage path.

## 5. Test your first generation

1. Enter a project name in **Add or link project**, for example “My App”.
2. Press Enter or click the add control. Fill in the description and create/link the project.
3. Enter: `Generate one common app favorite icon: a five-point star with smooth, even lines.`
4. Submit and wait for parsing, drawing, and review. Do not refresh or submit repeatedly during generation.
5. Select the resulting icon and click its download control to open details.
6. Switch between Linear, Outline, Bold, Broken, Bulk, and Twotone; inspect code and choose a download format. Code formats include SVG, Vue, React, HTML, Svelte, and Web Components.
7. Refresh after completion to check that the project and result remain saved.

If no project is linked, the app asks you to create or select one; this is not a model failure. Six-style generation and review involve multiple calls and may take several minutes. “Continue review” means review is incomplete, not fully accepted.

The library is available at [http://127.0.0.1:3000/library](http://127.0.0.1:3000/library) without a generation request. Use the navigation's language control to switch to English.

## 6. Build for regular use

Stop the development server, then build:

```bash
npm run build:local
```

After a successful build:

```bash
npm run start:local
```

The address stays the same. For later sessions, run `npm run start:local` from the repository root. Rebuild after source changes, upgrades, or changes to `NEXT_PUBLIC_` configuration.

| Command | Purpose |
| --- | --- |
| npm ci | Install dependencies according to the lockfile. |
| npm run dev:local | Development server with source updates. |
| npm run build:local | Compile the local version; does not keep a server running. |
| npm run start:local | Run the compiled local version. |
| Ctrl+C | Stop the server in the current terminal. |

Do not run two servers on the same port. Do not use default `npm run start` for local mode. The app does not automatically start after a computer reboot.

## 7. Data and backups

### Default locations

```text
icongen/
├── apps/web/.env.local          Model configuration and credentials
├── .local/easy-icon/
│   ├── workspace.sqlite        Projects, icons, favorites, recycled items
│   ├── workspace.sqlite-wal    May exist while running
│   └── workspace.sqlite-shm    May exist while running
└── apps/web/public/library/     Bundled library assets
```

Six-style SVGs, positions, setting snapshots, and generation context are saved in SQLite. No separate Storage service is required. Downloads go to your browser's selected destination.

Optionally set `EASY_ICON_DATA_DIR` in `.env.local` to a private **absolute path**. Restart after changing it. Switching directories does not move data automatically and may show a new empty workspace.

### Back up

1. Stop the server with `Ctrl+C`.
2. Copy the **entire** `.local/easy-icon` directory, including any WAL/SHM files.
3. Back up `.env.local` separately to a private location; it contains credentials.
4. Restart the app.

macOS / Linux example; choose a new destination name for each backup:

```bash
mkdir -p .local/backups
cp -R .local/easy-icon .local/backups/easy-icon-backup-01
```

Windows users can copy the complete folder in File Explorer. Include the hidden `.local` directory. Do not copy only the main SQLite file while the app is running: recent data may still be in the WAL.

### Restore or move to another computer

1. Stop the app.
2. Move the current data directory aside as a backup; preserve the pre-restore data.
3. Restore the full backup to `.local/easy-icon`, or the configured `EASY_ICON_DATA_DIR`.
4. On another computer, install the same source version and Node.js, run `npm ci`, and configure the model endpoint.
5. Build, start, and check projects and icons.

Never overwrite your only data copy. Local mode does not automatically import or delete historical Supabase accounts and assets.

## 8. Update

Stop the app and back up your data and private configuration first. Do not overwrite uncommitted source changes.

For a clean Git checkout:

```bash
git pull --ff-only
npm ci
npm run build:local
npm run start:local
```

For ZIP installations, extract the new version into another folder and migrate data/configuration using the steps above. Do not replace your `.env.local` with a new template. Follow release-specific instructions if the data format changes.

## 9. Troubleshooting

| Symptom | Check |
| --- | --- |
| node / npm not found | Reopen the terminal after installation and check PATH. |
| Node.js 24 required | Upgrade and check the version in this terminal, not another shell. |
| package.json missing | Run from the repository root containing apps and packages. |
| npm network or certificate error | Check network, npm settings, and enterprise proxy. Do not disable TLS verification. |
| Sharp/dependency installation fails | Match OS, CPU architecture, and Node version; do not reuse another machine's node_modules. |
| Port 3000 in use | Stop the previous server, or set `PORT=3001` and matching `NEXT_PUBLIC_APP_URL` in `.env.local`. Use the address shown after restart. |
| Page cannot open | Confirm the server reports Ready and remains running. Use HTTP, not HTTPS, for the default local address. |
| Sign-in still required | Stop the legacy server and use dev:local or build:local followed by start:local. |
| Production build missing | Run build:local successfully before start:local. |
| New key not taking effect | Restart; check that an old process is not serving the port. |
| Invalid planner model configuration | Verify ICON_PLANNER_MODEL and gateway group/model routing. |
| 401 / 403 / no available account | Check API key, upstream authorization, account state, group access, and quota. This is not SQLite authentication. |
| 429 / timeout / partial failure | Check provider limits; avoid duplicate submissions and use the offered retry/review action. |
| Project or icon save fails | Check writable data directory, free disk space, and server errors. Do not delete the database as a fix. |
| Projects disappear after a directory change | Restore the old EASY_ICON_DATA_DIR or move the entire database directory while stopped. |
| Data missing after restart | Verify the same checkout, local mode, and data directory are being used. |

Share error messages or redacted screenshots for diagnosis, not full `.env.local` files, API keys, cookies, or upstream tokens.

## 10. Tests and security boundaries

With the server running on the default port 3000, use another terminal at the repository root:

```bash
node --test scripts/local-database.test.mjs
node scripts/test-simple-local.mjs
npm run typecheck
```

Database tests use temporary directories. API tests create and remove their own temporary project and cover persistence, six-style saving, favorites, recycle/restore, and same-origin protection. They use fixture SVGs and make no model requests. They do not replace real generation or visual acceptance testing. The current API test script expects port 3000.

The server binds to 127.0.0.1 and checks Host and mutation Origin. **This mode is only for one user on one computer, not public hosting, multiple users, or LAN sharing.** Do not bind to `0.0.0.0`, expose it through tunnels, or bypass those checks.

Legacy Supabase SDK and compatibility code remain, but local mode does not need its services. An optional model gateway's use of Docker is independent of the website's deployment requirements.
