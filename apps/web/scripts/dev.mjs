import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const workerEnvPath = resolve(process.cwd(), "../../services/icon-worker/.env");
const webEnvPath = resolve(process.cwd(), ".env.local");

// Load the web application's local environment before starting Next. Next also
// reads this file, but loading it here makes provider configuration available
// to the launcher and lets us fail before a generation request is created.
if (existsSync(webEnvPath)) {
  process.loadEnvFile(webEnvPath);
}

const localMode = process.argv.includes("--local");
if (localMode) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Local SQLite mode requires Node.js 24 or newer.');
  process.env.EASY_ICON_LOCAL_MODE = "true";
  process.env.NEXT_PUBLIC_EASY_ICON_LOCAL_MODE = "true";
  process.env.APP_ENV = "development";
  process.env.NEXT_PUBLIC_APP_ENV = "development";
  process.env.SUPABASE_ENVIRONMENT = "development";
}
if (!localMode && existsSync(workerEnvPath)) {
  process.loadEnvFile(workerEnvPath);
}

const missingProviderSettings = ["IMAGE_PROVIDER_BASE_URL", "IMAGE_PROVIDER_API_KEY"]
  .filter((name) => !process.env[name]?.trim());

if (missingProviderSettings.length > 0) {
  console.error(
    `[dev] Missing icon-generation provider settings: ${missingProviderSettings.join(", ")}. ` +
    "Add them to apps/web/.env.local before starting the frontend.",
  );
  console.warn("[dev] The workspace can open; generation remains unavailable until configured.");
}

const nextBin = resolve(process.cwd(), "../../node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", ...process.argv.slice(2).filter(arg => arg !== "--local")], {
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
