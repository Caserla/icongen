import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const [email, jobId] = process.argv.slice(2);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const expectedCharge = Number(process.env.E2E_EXPECT_DETAIL_CHARGE ?? "0");
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !jobId || !supabaseUrl || !serviceRoleKey)
  throw new Error("Usage: node scripts/e2e-detail-edit-flow.mjs <email> <job-id>");

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const users = await admin.auth.admin.listUsers({ perPage: 100 });
if (users.error) throw users.error;
const user = users.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error("Test account not found");
async function balance() {
  const result = await admin.from("credit_accounts").select("balance").eq("user_id", user.id).single();
  if (result.error) throw result.error;
  return result.data.balance;
}

const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });
const instruction = "Make the magnifying glass handle slightly thicker while preserving the exact original style";
const balanceBefore = await balance();
await page.goto(`${baseUrl}/icons/${jobId}`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Adjust details" }).first().click();
const textarea = page.locator("textarea");
await textarea.waitFor({ timeout: 20_000 });
const quotaBefore = await page.getByText(/free detail edits left|Free edits used up/).textContent();
await textarea.fill(instruction);
const [createdResponse] = await Promise.all([
  page.waitForResponse((response) => response.url().includes("/edits") && response.request().method() === "POST"),
  page.getByRole("button", { name: "Generate adjustment" }).click(),
]);
const createdBody = await createdResponse.json().catch(() => ({}));
if (createdResponse.status() !== 202)
  throw new Error(`Detail edit submission returned ${createdResponse.status()}: ${createdBody.message ?? createdBody.error ?? "unknown"}`);
const editId = createdBody.id;
if (!editId) throw new Error("Detail edit response did not include an ID");

await page.getByRole("button", { name: "Back to results" }).click();
await page.getByRole("button", { name: "Adjust details" }).first().click();
await page.getByText("Adjusting....").waitFor({ timeout: 20_000 });
if ((await page.locator("textarea").inputValue()) !== instruction)
  throw new Error("Instruction was not restored after leaving and reopening the edit view");

const deadline = Date.now() + 12 * 60_000;
let revision;
while (Date.now() < deadline) {
  const queried = await admin.from("generation_variant_revisions")
    .select("id,variant_id,status,error_code,error_message,preview_path")
    .eq("id", editId).single();
  if (queried.error) throw queried.error;
  revision = queried.data;
  if (["completed", "failed"].includes(revision.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
if (!revision || revision.status !== "completed")
  throw new Error(`Detail edit did not complete: ${revision?.error_code ?? "timeout"} ${revision?.error_message ?? ""}`);

await page.getByRole("button", { name: "Back to results" }).click();
await page.getByRole("button", { name: "Adjust details" }).first().click();
await page.getByText("Choose a version").waitFor({ timeout: 30_000 });
const versions = page.locator(".variant-version-option");
if ((await versions.count()) !== 2) throw new Error("Original/new comparison did not render two versions");
await versions.nth(0).click();
if ((await versions.nth(0).getAttribute("aria-pressed")) !== "true") throw new Error("Original version selection failed");
await versions.nth(1).click();
if ((await versions.nth(1).getAttribute("aria-pressed")) !== "true") throw new Error("New version selection failed");
const [applyResponse] = await Promise.all([
  page.waitForResponse((response) => response.url().endsWith("/apply") && response.request().method() === "POST"),
  page.getByRole("button", { name: "Update" }).click(),
]);
if (!applyResponse.ok()) throw new Error(`Applying adjusted version returned ${applyResponse.status()}`);
await page.getByRole("button", { name: "Adjust details" }).first().waitFor({ timeout: 30_000 });

const [variant, ledger] = await Promise.all([
  admin.from("generation_variants").select("active_revision_id").eq("id", revision.variant_id).single(),
  admin.from("credit_ledger").select("entry_type,amount,note,idempotency_key").eq("user_id", user.id).gte("created_at", new Date(Date.now() - 20 * 60_000).toISOString()),
]);
if (variant.error) throw variant.error;
if (ledger.error) throw ledger.error;
const balanceAfter = await balance();
if (variant.data.active_revision_id !== editId) throw new Error("Applied revision is not active");
const editCharges = (ledger.data ?? []).filter((entry) =>
  entry.idempotency_key === `variant-edit-debit:${editId}` || entry.note?.includes(editId));
if (createdBody.chargedCredits !== expectedCharge)
  throw new Error(`Expected chargedCredits=${expectedCharge}, received ${createdBody.chargedCredits}`);
if (balanceAfter !== balanceBefore - expectedCharge)
  throw new Error(`Expected balance ${balanceBefore - expectedCharge}, received ${balanceAfter}`);
if (editCharges.length !== expectedCharge || (expectedCharge > 0 && editCharges[0]?.amount !== -expectedCharge))
  throw new Error(`Expected ${expectedCharge} matching debit ledger row(s), received ${editCharges.length}`);

await browser.close();
console.log(JSON.stringify({
  jobId,
  editId,
  quotaBefore,
  revisionStatus: revision.status,
  chargedCredits: expectedCharge,
  balanceBefore,
  balanceAfter,
  instructionRestoredAfterReentry: true,
  comparisonOriginalSelectable: true,
  comparisonNewSelectable: true,
  appliedRevisionActive: true,
}, null, 2));
