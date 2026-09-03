import { createClient } from "@supabase/supabase-js";

const [action, emailInput] = process.argv.slice(2);
const email = emailInput?.trim().toLowerCase();
if (!["grant", "revoke"].includes(action) || !email)
  throw new Error(
    "Usage: node scripts/set-admin-role.mjs <grant|revoke> <email>",
  );
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase server configuration is required");
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let page = 1;
let target;
const administrators = [];
while (true) {
  const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (result.error) throw result.error;
  for (const user of result.data.users) {
    if (user.app_metadata?.role === "admin") administrators.push(user.id);
    if (user.email?.toLowerCase() === email) target = user;
  }
  if (result.data.users.length < 1000) break;
  page += 1;
}
if (!target) throw new Error("User was not found");
if (
  action === "revoke" &&
  target.app_metadata?.role === "admin" &&
  administrators.length <= 1
) {
  throw new Error("Refusing to revoke the final administrator");
}
const nextMetadata = { ...target.app_metadata };
if (action === "grant") nextMetadata.role = "admin";
else delete nextMetadata.role;
const updated = await admin.auth.admin.updateUserById(target.id, {
  app_metadata: nextMetadata,
});
if (updated.error) throw updated.error;
const audit = await admin
  .from("admin_audit_logs")
  .insert({
    actor_user_id: target.id,
    action: `admin_role_${action === "grant" ? "granted" : "revoked"}`,
    target_type: "user",
    target_id: target.id,
    metadata: { source: "admin_role_cli" },
  });
if (audit.error) throw audit.error;
console.log(
  JSON.stringify(
    {
      userId: target.id,
      role: updated.data.user.app_metadata?.role ?? "user",
      sessionRefreshRequired: true,
    },
    null,
    2,
  ),
);
