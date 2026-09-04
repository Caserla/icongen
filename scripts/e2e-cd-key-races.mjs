import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase environment variables are required");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;

async function createTestAccount(label) {
  const email = `e2e-cd-key-${label}-${runId}@example.com`;
  const created = await admin.auth.admin.createUser({
    email,
    password: `E2e-${randomUUID()}-Aa1!`,
    email_confirm: true,
    user_metadata: { display_name: `CD Key ${label}` },
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("Could not create test account");
  return { id: created.data.user.id, email };
}

async function createCode(credits = 1) {
  const result = await admin.rpc("create_credit_redemption_code", {
    p_credits: credits,
    p_expires_at: null,
    p_note: `Browser race E2E ${runId}`,
  });
  if (result.error) throw result.error;
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.generated_code) throw new Error("CD-Key creation returned no plaintext code");
  const normalized = row.generated_code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return {
    code: row.generated_code,
    hash: createHash("sha256").update(normalized).digest("hex"),
  };
}

async function balance(userId) {
  const result = await admin.from("credit_accounts").select("balance").eq("user_id", userId).single();
  if (result.error) throw result.error;
  return result.data.balance;
}

async function openCredits(email) {
  const session = await openAuthenticatedBrowser({ email, baseUrl });
  await session.page.goto(`${baseUrl}/account/credits`, { waitUntil: "domcontentloaded" });
  await session.page.locator("#credit-code").waitFor();
  return session;
}

async function submit(page, code) {
  await page.locator("#credit-code").fill(code);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/account/credits/redeem") && response.request().method() === "POST",
  );
  await page.locator("form").filter({ has: page.locator("#credit-code") }).getByRole("button").click();
  const response = await responsePromise;
  const payload = await response.json();
  return { status: response.status(), payload };
}

const first = await createTestAccount("a");
const second = await createTestAccount("b");
const firstSession = await openCredits(first.email);

const disabled = await createCode();
const disabledUpdate = await admin.from("credit_redemption_codes")
  .update({ disabled_at: new Date().toISOString(), disabled_reason: "E2E disabled state" })
  .eq("code_hash", disabled.hash);
if (disabledUpdate.error) throw disabledUpdate.error;
const disabledResult = await submit(firstSession.page, disabled.code);
if (disabledResult.status !== 409 || disabledResult.payload.error !== "CD_KEY_DISABLED")
  throw new Error(`Disabled CD-Key page flow failed: ${JSON.stringify(disabledResult)}`);
await firstSession.page.locator("p[role='alert']").waitFor();

const expired = await createCode();
const expiredUpdate = await admin.from("credit_redemption_codes")
  .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
  .eq("code_hash", expired.hash);
if (expiredUpdate.error) throw expiredUpdate.error;
const expiredResult = await submit(firstSession.page, expired.code);
if (expiredResult.status !== 410 || expiredResult.payload.error !== "CD_KEY_EXPIRED")
  throw new Error(`Expired CD-Key page flow failed: ${JSON.stringify(expiredResult)}`);
await firstSession.page.locator("p[role='alert']").waitFor();

const secondSession = await openCredits(second.email);
const concurrent = await createCode(7);
const before = await Promise.all([balance(first.id), balance(second.id)]);
await Promise.all([
  firstSession.page.locator("#credit-code").fill(concurrent.code),
  secondSession.page.locator("#credit-code").fill(concurrent.code),
]);
const responses = await Promise.all([
  submit(firstSession.page, concurrent.code),
  submit(secondSession.page, concurrent.code),
]);
const successes = responses.filter((item) => item.status === 200);
const conflicts = responses.filter((item) => item.status === 409 && item.payload.error === "CD_KEY_ALREADY_REDEEMED");
if (successes.length !== 1 || conflicts.length !== 1)
  throw new Error(`Concurrent redemption was not serialized: ${JSON.stringify(responses)}`);

const after = await Promise.all([balance(first.id), balance(second.id)]);
if ((after[0] - before[0]) + (after[1] - before[1]) !== 7)
  throw new Error(`Concurrent redemption credited an invalid total: before=${before}, after=${after}`);
const ledger = await admin.from("credit_ledger").select("id,user_id,amount")
  .eq("redemption_code_id", (await admin.from("credit_redemption_codes").select("id").eq("code_hash", concurrent.hash).single()).data.id);
if (ledger.error || ledger.data.length !== 1 || ledger.data[0].amount !== 7)
  throw ledger.error ?? new Error(`Expected one redemption ledger entry: ${JSON.stringify(ledger.data)}`);

await Promise.all([firstSession.browser.close(), secondSession.browser.close()]);
console.log(JSON.stringify({
  disabledPageState: "passed",
  expiredPageState: "passed",
  concurrentAccounts: 2,
  concurrentSuccesses: successes.length,
  concurrentConflicts: conflicts.length,
  totalCreditsGranted: 7,
  ledgerEntries: ledger.data.length,
}, null, 2));
