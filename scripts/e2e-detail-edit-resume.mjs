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
const subject = await admin.from("generation_subjects").select("id").eq("job_id", jobId).order("position").limit(1).single();
if (subject.error) throw subject.error;
const variant = await admin.from("generation_variants").select("id,active_revision_id").eq("subject_id", subject.data.id).eq("slot", 1).single();
if (variant.error) throw variant.error;
const latest = await admin.from("generation_variant_revisions").select("id,status,error_code,error_message").eq("variant_id", variant.data.id).order("created_at", { ascending: false }).limit(1).single();
if (latest.error) throw latest.error;
const balanceBeforeResult = await admin.from("credit_accounts").select("balance").eq("user_id", user.id).single();
if (balanceBeforeResult.error) throw balanceBeforeResult.error;
const balanceBefore = balanceBeforeResult.data.balance;
let revision = latest.data;
const deadline = Date.now() + 12 * 60_000;
while (!["completed", "failed"].includes(revision.status) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  const polled = await admin.from("generation_variant_revisions").select("id,status,error_code,error_message").eq("id", revision.id).single();
  if (polled.error) throw polled.error;
  revision = polled.data;
}
if (revision.status !== "completed") throw new Error(`Edit failed: ${revision.error_code ?? "timeout"} ${revision.error_message ?? ""}`);

const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });
await page.goto(`${baseUrl}/icons/${jobId}`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Adjust details" }).first().click();
await page.getByText("Choose a version").waitFor({ timeout: 30_000 });
const versions = page.locator(".variant-version-option");
if ((await versions.count()) !== 2) throw new Error("Expected original and new version choices");
await versions.first().click();
if ((await versions.first().getAttribute("aria-pressed")) !== "true") throw new Error("Original selection failed");
await versions.nth(1).click();
if ((await versions.nth(1).getAttribute("aria-pressed")) !== "true") throw new Error("New selection failed");
const [applied] = await Promise.all([
  page.waitForResponse((response) => response.url().endsWith("/apply") && response.request().method() === "POST"),
  page.getByRole("button", { name: "Update" }).click(),
]);
if (!applied.ok()) throw new Error(`Apply returned ${applied.status()}`);
await page.getByRole("button", { name: "Adjust details" }).first().waitFor({ timeout: 30_000 });
const [active, balanceAfterResult] = await Promise.all([
  admin.from("generation_variants").select("active_revision_id").eq("id", variant.data.id).single(),
  admin.from("credit_accounts").select("balance").eq("user_id", user.id).single(),
]);
if (active.error) throw active.error;
if (balanceAfterResult.error) throw balanceAfterResult.error;
if (active.data.active_revision_id !== revision.id) throw new Error("Applied revision did not become active");
if (balanceAfterResult.data.balance !== balanceBefore) throw new Error("Free edit changed balance");
await browser.close();
console.log(JSON.stringify({ jobId, variantId: variant.data.id, editId: revision.id, status: revision.status, originalSelectable: true, newSelectable: true, applied: true, balanceBefore, balanceAfter: balanceAfterResult.data.balance }, null, 2));
