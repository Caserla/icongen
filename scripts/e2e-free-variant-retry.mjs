import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const [email, jobId] = process.argv.slice(2);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !jobId || !supabaseUrl || !serviceRoleKey) throw new Error("email and job ID are required");
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const users = await admin.auth.admin.listUsers({ perPage: 100 });
if (users.error) throw users.error;
const user = users.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error("Test account not found");
async function balance() {
  const row = await admin.from("credit_accounts").select("balance").eq("user_id", user.id).single();
  if (row.error) throw row.error;
  return row.data.balance;
}
const before = await balance();
const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });
await page.goto(`${baseUrl}/icons/${jobId}`, { waitUntil: "domcontentloaded" });
const retry = page.getByRole("button", { name: "Try this option again" }).first();
await retry.waitFor({ timeout: 30_000 });
const [response] = await Promise.all([
  page.waitForResponse((candidate) => candidate.url().endsWith("/retry") && candidate.request().method() === "POST"),
  retry.click(),
]);
const body = await response.json().catch(() => ({}));
if (response.status() !== 202) throw new Error(`Retry returned ${response.status()} ${body.message ?? body.error ?? ""}`);
const variantId = body.variantId;
const deadline = Date.now() + 12 * 60_000;
let variant;
while (Date.now() < deadline) {
  const row = await admin.from("generation_variants").select("id,status,error_code,error_message").eq("id", variantId).single();
  if (row.error) throw row.error;
  variant = row.data;
  if (["completed", "failed"].includes(variant.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
const after = await balance();
if (after !== before) throw new Error(`Free retry changed balance from ${before} to ${after}`);
await browser.close();
console.log(JSON.stringify({ jobId, variantId, retryStatus: variant?.status ?? "timeout", errorCode: variant?.error_code ?? null, balanceBefore: before, balanceAfter: after, charged: false }, null, 2));
