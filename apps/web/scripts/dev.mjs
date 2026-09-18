import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const workerEnvPath = resolve(process.cwd(), "../../services/icon-worker/.env");

if (existsSync(workerEnvPath)) {
  process.loadEnvFile(workerEnvPath);
}

const nextBin = resolve(process.cwd(), "../../node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev"], {
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
