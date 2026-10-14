import { cp, mkdir, readFile, writeFile, chmod, access } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const root = resolve(import.meta.dirname, "..");
const destination = resolve(root, ".local/supabase");
const exists = async path => access(path).then(() => true, () => false);
const secret = bytes => randomBytes(bytes).toString("hex");

await mkdir(destination, { recursive: true, mode: 0o700 });
if (process.argv.includes("--connect-web")) {
  const values = Object.fromEntries((await readFile(resolve(destination, ".env"), "utf8")).split("\n").filter(line => line && !line.startsWith("#")).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)]; }));
  const file = resolve(root, "apps/web/.env.local");
  const original = await readFile(file, "utf8");
  const backup = resolve(destination, "web-env-before-local.backup");
  if (!await exists(backup)) await writeFile(backup, original, { mode: 0o600 });
  const updates = {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:18000",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    APP_ENV: "development", NEXT_PUBLIC_APP_ENV: "development", SUPABASE_ENVIRONMENT: "development",
    SUPABASE_ICON_BUCKET: "generated-icons", PUBLIC_SIGNUP_ENABLED: "true",
  };
  let next = original;
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    next = pattern.test(next) ? next.replace(pattern, `${key}=${value}`) : `${next.trimEnd()}\n${key}=${value}\n`;
  }
  await writeFile(file, next, { mode: 0o600 });
  await chmod(file, 0o600);
  console.log("Web environment connected to loopback-only local Supabase; original saved privately.");
} else {
  const source = process.argv[2];
  if (!source) throw new Error("Supply the docker directory of official self-hosted/v0.8.2 Supabase source.");
  if (await exists(resolve(destination, "compose.yml"))) throw new Error("Already configured; reuse existing compose and secrets.");
  await cp(resolve(source, "volumes"), resolve(destination, "volumes"), { recursive: true });
  const original = yaml.load(await readFile(resolve(source, "docker-compose.yml"), "utf8"));
  const services = Object.fromEntries(["db", "auth", "rest", "storage", "imgproxy", "meta", "studio", "api-gw"].map(name => [name, original.services[name]]));
  for (const service of Object.values(services)) delete service.container_name;
  // macOS bind mounts do not support Storage's required extended attributes.
  services.storage.volumes = ["storage-data:/var/lib/storage"];
  services.imgproxy.volumes = ["storage-data:/var/lib/storage"];
  services.mailpit = { image: "axllent/mailpit:v1.27", restart: "unless-stopped", ports: ["127.0.0.1:18025:8025"], volumes: ["mail-data:/data"], environment: { MP_DATABASE: "/data/mailpit.db" } };
  services.auth.depends_on.mailpit = { condition: "service_started" };
  services.auth.environment.GOTRUE_SMTP_MAX_FREQUENCY = "1s";
  // Keep unused features out of this local stack; runtime data is never tracked.
  const compose = { name: "easy-icon-local", services, volumes: { "db-config": {}, "mail-data": {}, "storage-data": {} } };
  await writeFile(resolve(destination, "compose.yml"), yaml.dump(compose, { lineWidth: -1, noRefs: true }));
  const jwtSecret = secret(32);
  const jwt = role => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, iss: "supabase-local", iat: now, exp: now + 10 * 365 * 86400 })}`;
    return `${content}.${createHmac("sha256", jwtSecret).update(content).digest("base64url")}`;
  };
  let env = await readFile(resolve(source, ".env.example"), "utf8");
  const values = {
    COMPOSE_FILE: "compose.yml", POSTGRES_PASSWORD: secret(24), JWT_SECRET: jwtSecret,
    ANON_KEY: jwt("anon"), SERVICE_ROLE_KEY: jwt("service_role"),
    DASHBOARD_USERNAME: "local-admin", DASHBOARD_PASSWORD: secret(24),
    SECRET_KEY_BASE: secret(48), REALTIME_DB_ENC_KEY: secret(8), VAULT_ENC_KEY: secret(16), PG_META_CRYPTO_KEY: secret(24),
    LOGFLARE_PUBLIC_ACCESS_TOKEN: secret(24), LOGFLARE_PRIVATE_ACCESS_TOKEN: secret(24), S3_PROTOCOL_ACCESS_KEY_ID: secret(16), S3_PROTOCOL_ACCESS_KEY_SECRET: secret(32),
    SUPABASE_PUBLIC_URL: "http://127.0.0.1:18000", API_EXTERNAL_URL: "http://127.0.0.1:18000/auth/v1",
    SITE_URL: "http://127.0.0.1:3000", ADDITIONAL_REDIRECT_URLS: "http://127.0.0.1:3000/**,http://localhost:3000/**",
    API_GW_HTTP_PORT: "127.0.0.1:18000", SMTP_HOST: "mailpit", SMTP_PORT: "1025", SMTP_USER: "", SMTP_PASS: "",
    SMTP_ADMIN_EMAIL: "local@easy-icon.test", SMTP_SENDER_NAME: "EASY ICON Local",
    ENABLE_PHONE_SIGNUP: "false", ENABLE_PHONE_AUTOCONFIRM: "false", OPENAI_API_KEY: "",
    STUDIO_DEFAULT_ORGANIZATION: "Local", STUDIO_DEFAULT_PROJECT: "EASY ICON",
  };
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    env = pattern.test(env) ? env.replace(pattern, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
  }
  await writeFile(resolve(destination, ".env"), env, { mode: 0o600 });
  console.log("Local stack prepared. Secrets are private; existing containers and cloud data unchanged.");
}
