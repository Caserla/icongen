import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const api = process.env.NEXT_PUBLIC_SUPABASE_URL;
const web = "http://127.0.0.1:3000";
assert.equal(api, "http://127.0.0.1:18000", "Refuse testing a non-local database");
const admin = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `smoke-${randomUUID()}@easy-icon.test`;
const password = randomBytes(24).toString("hex");
let userId;
const path = `local-smoke/${randomUUID()}.txt`;
const bucket = "generated-icons";
try {
  const settings = await fetch(`${api}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } });
  assert.equal(settings.status, 200);
  const settingsData = await settings.json();
  assert.equal(settingsData.mailer_autoconfirm, false, "Email verification must remain enabled");
  console.log("PASS local Auth available; email verification retained");
  const publicClient = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = await publicClient.auth.signUp({ email, password });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  assert.equal(created.data.session, null, "Unverified registration must not establish a session");
  const mailbox = await (await fetch("http://127.0.0.1:18025/api/v1/messages")).json();
  const confirmation = mailbox.messages.find(message => message.To?.some(recipient => recipient.Address === email));
  assert.ok(confirmation, "Confirmation email not delivered to local Mailpit");
  const message = await (await fetch(`http://127.0.0.1:18025/api/v1/message/${confirmation.ID}`)).json();
  const link = (message.HTML ?? "").match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/);
  assert.ok(link, "Confirmation link absent");
  const confirmationUrl = new URL(link[1].replaceAll("&amp;", "&"));
  assert.equal(confirmationUrl.origin, api, "Refuse external confirmation link");
  const verified = await fetch(confirmationUrl, { redirect: "manual" });
  assert.ok([302, 303].includes(verified.status), "Email confirmation failed");
  assert.ok(!new URL(verified.headers.get("location")).searchParams.has("error"));
  console.log("PASS signup, local confirmation email, email verification");
  const login = await fetch(`${web}/api/auth/sign-in`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: web },
    body: JSON.stringify({ email, password, next: "/create" }),
  });
  assert.equal(login.status, 200, "Local email login failed");
  assert.equal((await login.json()).next, "/create");
  const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.ok(cookie, "Session cookie absent");
  const headers = { Cookie: cookie, Origin: web, "Content-Type": "application/json" };
  const create = await fetch(`${web}/create`, { headers, redirect: "manual" });
  assert.equal(create.status, 200, "Create page redirected after login");
  assert.ok((await create.text()).includes("EASY ICON"));
  const account = await fetch(`${web}/api/account`, { headers });
  assert.equal(account.status, 200);
  assert.equal((await account.json()).id, userId);
  console.log("PASS email login, session cookie, create page, account profile");
  const project = await fetch(`${web}/api/projects`, { method: "POST", headers, body: JSON.stringify({ name: "本地部署验证", description: "仅用于验证本地数据库读写的临时项目" }) });
  assert.equal(project.status, 201);
  const id = (await project.json()).item.id;
  const projects = await fetch(`${web}/api/projects`, { headers });
  assert.equal(projects.status, 200);
  assert.ok((await projects.json()).items.some(item => item.id === id));
  const removed = await fetch(`${web}/api/projects/${id}`, { method: "DELETE", headers });
  assert.ok(removed.ok, "Test project cleanup failed");
  console.log("PASS authenticated project create/list/delete");
  const uploaded = await admin.storage.from(bucket).upload(path, Buffer.from("local-storage-smoke"), { contentType: "text/plain" });
  if (uploaded.error) throw uploaded.error;
  const downloaded = await admin.storage.from(bucket).download(path);
  if (downloaded.error) throw downloaded.error;
  assert.equal(await downloaded.data.text(), "local-storage-smoke");
  console.log("PASS private local storage upload/download");
} finally {
  const removed = await admin.storage.from(bucket).remove([path]);
  if (removed.error) console.error("Test storage cleanup failed:", removed.error.message);
  if (userId) {
    const removedUser = await admin.auth.admin.deleteUser(userId);
    if (removedUser.error) throw removedUser.error;
  }
  console.log("Temporary test account and test file cleaned up; no cloud data touched.");
}
