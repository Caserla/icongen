import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const [emailInput, displayNameInput, actorEmailInput] = process.argv.slice(2);
const email = emailInput?.trim().toLowerCase();
const displayName = displayNameInput?.trim();
const actorEmail = actorEmailInput?.trim().toLowerCase();

if (!email || !displayName || !actorEmail) {
  throw new Error(
    "Usage: npm run admin:create -- <email> <display-name> <actor-email>",
  );
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("A valid email address is required");
}
if (displayName.length > 18) {
  throw new Error("Display name must be 18 characters or fewer");
}

const password = await readHiddenPassword();
if (password.length < 8)
  throw new Error("Password must be at least 8 characters");

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server configuration is required");

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (users.error) throw users.error;
if (users.data.users.some((user) => user.email?.toLowerCase() === email)) {
  throw new Error("An account with this email already exists");
}
const actor = users.data.users.find(
  (user) =>
    user.email?.toLowerCase() === actorEmail &&
    user.app_metadata?.role === "admin",
);
if (!actor)
  throw new Error("The audit actor must be an existing administrator");

const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "admin" },
  user_metadata: { display_name: displayName },
});
if (created.error) throw created.error;

const profile = await admin
  .from("profiles")
  .update({ display_name: displayName })
  .eq("id", created.data.user.id);
if (profile.error) throw profile.error;

const audit = await admin.from("admin_audit_logs").insert({
  actor_user_id: actor.id,
  action: "admin_account_created",
  target_type: "user",
  target_id: created.data.user.id,
  metadata: { source: "admin_account_cli", email, display_name: displayName },
});
if (audit.error) throw audit.error;

console.log(
  JSON.stringify(
    {
      userId: created.data.user.id,
      email: created.data.user.email,
      displayName,
      role: created.data.user.app_metadata?.role,
      emailConfirmed: Boolean(created.data.user.email_confirmed_at),
    },
    null,
    2,
  ),
);

async function readHiddenPassword() {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    let value = "";
    for await (const chunk of stdin) value += chunk;
    return value.replace(/[\r\n]+$/, "");
  }
  stdout.write("Initial password: ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return await new Promise((resolve, reject) => {
    let value = "";
    const restore = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    stdin.on("data", function onData(chunk) {
      if (chunk === "\u0003") {
        stdin.off("data", onData);
        restore();
        reject(new Error("Password entry was cancelled"));
      } else if (chunk === "\r" || chunk === "\n") {
        stdin.off("data", onData);
        restore();
        resolve(value);
      } else if (chunk === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += chunk;
      }
    });
  });
}
