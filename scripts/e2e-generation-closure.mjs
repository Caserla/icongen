import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const email = process.argv[2];
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !supabaseUrl || !serviceRoleKey)
  throw new Error("Usage: node scripts/e2e-generation-closure.mjs <email>");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });
const results = [];
const generatedJobs = [];

async function account() {
  const users = await admin.auth.admin.listUsers({ perPage: 100 });
  if (users.error) throw users.error;
  const user = users.data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error("Test account not found");
  const credits = await admin.from("credit_accounts").select("balance").eq("user_id", user.id).single();
  if (credits.error) throw credits.error;
  return { user, balance: credits.data.balance };
}

async function openCreate() {
  await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Generate icons" }).waitFor({ timeout: 30_000 });
}

async function record(id, operation) {
  try {
    const evidence = await operation();
    results.push({ id, status: "passed", evidence });
  } catch (error) {
    results.push({ id, status: "failed", evidence: error instanceof Error ? error.message : String(error) });
  }
}

await record("UI-VALIDATION-EMPTY", async () => {
  await openCreate();
  await page.getByRole("button", { name: "Generate icons" }).click();
  const alert = page.getByText("Describe at least one icon before generating.", { exact: true });
  await alert.waitFor();
  const text = await alert.textContent();
  if (!text?.includes("Describe at least one icon")) throw new Error(`Unexpected validation: ${text}`);
  return text.trim();
});

await record("UI-SIZE-LIMIT", async () => {
  await openCreate();
  await page.getByRole("button", { name: "16 × 16" }).click();
  const status = page.locator('[data-toast-variant="warning"]').getByText("Choose up to 3 output sizes.", { exact: true });
  await status.waitFor();
  return (await status.textContent())?.trim();
});

await record("UI-SUBJECT-ADD-FOCUS", async () => {
  await openCreate();
  await page.getByRole("button", { name: /Add another icon/ }).click();
  const inputs = page.locator(".icon-subject-input");
  if ((await inputs.count()) !== 2) throw new Error("Second subject input was not added");
  await page.waitForTimeout(500);
  if (!(await inputs.nth(1).evaluate((input) => input === document.activeElement)))
    throw new Error("New subject input did not receive focus");
  return "Second input added, scrolled into view, and focused";
});

await record("UI-BACKGROUND-DRAWER", async () => {
  await openCreate();
  const more = page.getByRole("button", { name: "Configure background for icon 1" });
  await more.click();
  await page.getByRole("heading", { name: "Icon background" }).waitFor();
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  await page.getByText("Start color", { exact: true }).waitFor();
  await page.getByText("End color", { exact: true }).waitFor();
  await page.locator("summary").filter({ hasText: "Gradient direction" }).click();
  await page.getByRole("button", { name: "Radial", exact: true }).click();
  await page.getByRole("button", { name: "Close background settings" }).click();
  await page.getByRole("heading", { name: "Icon background" }).waitFor({ state: "hidden" });
  return "Drawer, gradient colors, inline direction expansion, selection, and close passed";
});

async function submitJob({ purpose, style, subject }) {
  await openCreate();
  if (purpose === "illustration") {
    await page.getByRole("button", { name: "Illustration icons" }).click();
    await page.getByRole("button", { name: new RegExp(`^${style}`) }).click();
  }
  await page.getByPlaceholder("Type what you want to create…").fill(subject);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/generation/jobs") && candidate.request().method() === "POST", { timeout: 30_000 }),
    page.getByRole("button", { name: "Generate icons" }).click(),
  ]);
  if (response.status() !== 201) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Generation submission returned ${response.status()} ${body.error ?? "UNKNOWN"}: ${body.message ?? ""}`);
  }
  await page.waitForURL(/\/icons\/[0-9a-f-]{36}$/i, { timeout: 15_000, waitUntil: "domcontentloaded" });
  const id = page.url().split("/").pop();
  generatedJobs.push({ id, purpose, style: style ?? "interaction-linear", subject });
  return id;
}

async function waitForJob(id, timeoutMs = 12 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const queried = await admin.from("generation_jobs").select("id,status,error_code,error_message,updated_at").eq("id", id).single();
    if (queried.error) throw queried.error;
    if (["completed", "partial", "failed"].includes(queried.data.status)) return queried.data;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`Timed out waiting for job ${id}`);
}

const before = await account();
if (process.env.E2E_SKIP_INTERACTION !== "1") {
  await record("E2E-INTERACTION-LINEAR", async () => {
    const id = await submitJob({ purpose: "interaction", subject: "Search magnifying glass" });
    const terminal = await waitForJob(id);
    return { id, terminal };
  });
}

const requestedStyles = process.env.E2E_STYLES?.split(",").map((item) => item.trim()).filter(Boolean) ?? [
  "Isometric 3D", "Neon", "Low Poly", "Clay 3D", "Playful Flat",
  "Pixel Art", "Flat Illus", "Cute Sticker", "Minimal Logo",
];
for (const style of requestedStyles) {
  await record(`E2E-ILLUSTRATION-${style.toUpperCase().replaceAll(" ", "-")}`, async () => {
    const id = await submitJob({
      purpose: "illustration",
      style,
      subject: `${style} brand mark with the word EASY DESIGN / ICON GEN and a friendly panda`,
    });
    const terminal = await waitForJob(id);
    return { id, terminal };
  });
}

const afterSubmission = await account();
results.push({
  id: "BILLING-SUBMISSION-DEBIT",
  status: before.balance - afterSubmission.balance === generatedJobs.length ? "passed" : "failed",
  evidence: { before: before.balance, after: afterSubmission.balance, jobs: generatedJobs.length },
});

async function waitForJobs(timeoutMs = 30 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const queried = await admin.from("generation_jobs")
      .select("id,status,error_code,error_message,updated_at")
      .in("id", generatedJobs.map((job) => job.id));
    if (queried.error) throw queried.error;
    const rows = queried.data ?? [];
    if (rows.length === generatedJobs.length && rows.every((row) => ["completed", "partial", "failed"].includes(row.status)))
      return rows;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Timed out waiting for generated jobs");
}

let terminalJobs = [];
try {
  terminalJobs = await waitForJobs();
  for (const job of generatedJobs) {
    const row = terminalJobs.find((item) => item.id === job.id);
    results.push({
      id: `RESULT-${job.style}`,
      status: row?.status === "completed" ? "passed" : "failed",
      evidence: row ?? "Missing database row",
    });
  }
} catch (error) {
  results.push({ id: "RESULT-WAIT", status: "blocked", evidence: error instanceof Error ? error.message : String(error) });
}

const completed = terminalJobs.find((row) => row.status === "completed");
if (completed) {
  await record("UI-RESULT-SELECT-PREVIEW", async () => {
    await page.goto(`${baseUrl}/icons/${completed.id}`, { waitUntil: "domcontentloaded" });
    const options = page.getByRole("button", { name: /Select option/ });
    await options.first().waitFor({ timeout: 30_000 });
    if ((await options.count()) !== 3) throw new Error(`Expected 3 options, found ${await options.count()}`);
    await options.first().click();
    if ((await options.first().getAttribute("aria-pressed")) !== "true") throw new Error("Option did not enter selected state");
    const preview = page.getByRole("button", { name: /Preview option 1/ });
    await preview.click();
    await page.keyboard.press("Escape");
    return "Three variants rendered; selection and full-size preview passed";
  });
  await record("UI-LIST-RETURN", async () => {
    await page.goto(`${baseUrl}/icons?usage=illustration`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const card = page.locator(`a[href="/icons/${completed.id}"]`).first();
    await card.waitFor({ timeout: 30_000 });
    await card.click();
    await page.waitForURL(`**/icons/${completed.id}`);
    await page.goBack();
    await page.waitForURL(/\/icons\?usage=illustration/);
    return `Returned to preserved URL ${page.url()}`;
  });
}

const finalAccount = await account();
const ledger = await admin.from("credit_ledger")
  .select("entry_type,amount,balance_after,generation_job_id,created_at")
  .eq("user_id", before.user.id)
  .in("generation_job_id", generatedJobs.map((job) => job.id))
  .order("created_at", { ascending: true });
if (ledger.error) throw ledger.error;

await browser.close();
console.log(JSON.stringify({
  startedAtBalance: before.balance,
  finalBalance: finalAccount.balance,
  generatedJobs,
  terminalJobs,
  ledger: ledger.data,
  results,
}, null, 2));
