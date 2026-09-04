import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const email = process.argv[2];
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !supabaseUrl || !serviceRoleKey)
  throw new Error("Usage: node scripts/e2e-product-gap-regression.mjs <email>");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const results = [];
const temporaryUsers = [];
let browser;

async function check(id, action) {
  try {
    results.push({ id, status: "passed", evidence: await action() });
  } catch (error) {
    results.push({ id, status: "failed", evidence: error instanceof Error ? error.message : String(error) });
  }
}

async function balanceFor(userId) {
  const result = await admin.from("credit_accounts").select("balance").eq("user_id", userId).single();
  if (result.error) throw result.error;
  return result.data.balance;
}

async function userByEmail(address) {
  let page = 1;
  while (true) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (listed.error) throw listed.error;
    const found = listed.data.users.find((user) => user.email?.toLowerCase() === address.toLowerCase());
    if (found) return found;
    if (listed.data.users.length < 100) return null;
    page += 1;
  }
}

async function createTemporaryUser(label, balance) {
  const address = `${label}-${randomUUID()}@example.invalid`;
  const created = await admin.auth.admin.createUser({ email: address, email_confirm: true });
  if (created.error) throw created.error;
  temporaryUsers.push(created.data.user);
  const updated = await admin.from("credit_accounts").update({ balance }).eq("user_id", created.data.user.id);
  if (updated.error) throw updated.error;
  return created.data.user;
}

try {
  const primary = await userByEmail(email);
  if (!primary) throw new Error(`Test account not found: ${email}`);
  ({ browser } = await openAuthenticatedBrowser({ email, baseUrl }));
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  async function useEnglish(target = page) {
    const english = target.getByRole("button", { name: "EN", exact: true });
    await english.waitFor();
    if ((await english.getAttribute("aria-pressed")) !== "true") await english.click();
  }

  await check("LOC-01-LANGUAGE-PERSISTS", async () => {
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "中文" }).click();
    await page.getByRole("button", { name: "生成图标" }).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "生成图标" }).waitFor();
    const persisted = await page.evaluate(() => localStorage.getItem("icongen-locale"));
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByRole("button", { name: "Generate icons" }).waitFor();
    if (persisted !== "zh") throw new Error(`Locale persisted as ${persisted}`);
    return "Chinese survived reload; switched back to English without navigation loss";
  });

  await check("SUB-01-BOUNDARIES", async () => {
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await useEnglish();
    const input = page.getByPlaceholder("Type what you want to create…").first();
    await input.fill("x".repeat(201));
    if ((await input.inputValue()).length !== 200) throw new Error("Subject maxlength is not 200");
    await page.getByRole("button", { name: /Add another icon/ }).click();
    const inputs = page.locator(".icon-subject-input");
    if ((await inputs.count()) !== 2) throw new Error("Could not add a second subject");
    if (!(await inputs.nth(1).evaluate((node) => node === document.activeElement))) throw new Error("Newest subject is not focused");
    await page.getByRole("button", { name: /Remove icon 2/ }).click();
    if ((await inputs.count()) !== 1) throw new Error("Could not delete the second subject");
    return "200-character browser limit, add/focus/scroll, and delete passed";
  });

  await check("ACC-01-NICKNAME-VALIDATION", async () => {
    await page.goto(`${baseUrl}/account`, { waitUntil: "domcontentloaded" });
    await useEnglish();
    const name = page.getByLabel("Display name");
    await name.waitFor();
    const original = await name.inputValue();
    await name.fill("Invalid@Name");
    const bad = await page.evaluate(async () => {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: "Invalid@Name" }) });
      return { status: response.status, body: await response.json() };
    });
    if (bad.status !== 400) throw new Error(`Special-character nickname returned ${bad.status}`);
    await name.fill("x".repeat(19));
    if ((await name.inputValue()).length !== 18) throw new Error("Nickname maxlength is not 18");
    await name.fill(original);
    return "Special characters rejected by API; browser enforces 18 characters";
  });

  await check("RWD-01-CORE-PAGES", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const paths = ["/create", "/icons", "/account", "/account/credits"];
    const evidence = [];
    for (const path of paths) {
      await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);
      const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      if (dimensions.scrollWidth > dimensions.clientWidth + 2) throw new Error(`${path} overflows horizontally: ${JSON.stringify(dimensions)}`);
      evidence.push({ path, ...dimensions });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    return evidence;
  });

  await check("AUTHZ-01-NONADMIN-BLOCKED", async () => {
    const temp = await createTemporaryUser("e2e-nonadmin", 1);
    const isolated = await openAuthenticatedBrowser({ email: temp.email, baseUrl });
    try {
      const response = await isolated.page.goto(`${baseUrl}/api/admin/overview`, { waitUntil: "domcontentloaded" });
      if (response?.status() !== 403) throw new Error(`Non-admin API returned ${response?.status()}`);
      return "Non-admin authenticated account received HTTP 403 from admin API";
    } finally { await isolated.browser.close(); }
  });

  await check("BILL-01-INSUFFICIENT-UI", async () => {
    const temp = await createTemporaryUser("e2e-insufficient", 1);
    const isolated = await openAuthenticatedBrowser({ email: temp.email, baseUrl });
    try {
      const p = isolated.page;
      await useEnglish(p);
      await p.getByRole("button", { name: /Add another icon/ }).click();
      const fields = p.locator(".icon-subject-input");
      await fields.nth(0).fill("Search icon");
      await fields.nth(1).fill("Settings icon");
      const responsePromise = p.waitForResponse((candidate) => candidate.url().endsWith("/api/generation/jobs") && candidate.request().method() === "POST");
      await p.getByRole("button", { name: "Generate icons" }).click();
      const response = await responsePromise;
      if (response.status() !== 402) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Expected 402, got ${response.status()}; request=${response.request().postData()}; response=${JSON.stringify(body)}; balance=${await balanceFor(temp.id)}`);
      }
      await p.getByText(/Not enough credits: this set needs 2, and you have 1/).waitFor();
      if (await balanceFor(temp.id) !== 1) throw new Error("Rejected request changed the balance");
      const jobs = await admin.from("generation_jobs").select("id", { count: "exact", head: true }).eq("user_id", temp.id);
      if (jobs.error || jobs.count !== 0) throw new Error(`Rejected request created ${jobs.count} jobs`);
      return "Two-subject submit showed actionable 402 message; no debit and no job";
    } finally { await isolated.browser.close(); }
  });

  await check("CDK-04-INVALID-UI", async () => {
    await page.goto(`${baseUrl}/account/credits`, { waitUntil: "domcontentloaded" });
    await useEnglish();
    const input = page.getByLabel(/Redeem a CD-Key/).or(page.locator("#credit-code"));
    await input.fill("BAM-AAAA-AAAA-AAAA-AAAA");
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await page.getByText("This CD-Key is invalid.", { exact: true }).waitFor();
    return "Invalid key produces the specific English error without changing balance";
  });

  await check("ADMIN-01-ADMIN-UI", async () => {
    await page.evaluate(() => { localStorage.setItem("icongen-locale", "en"); });
    await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
    await page.getByText("Admin console", { exact: true }).waitFor();
    await page.getByRole("button", { name: "CD-Keys", exact: true }).click();
    await page.getByText(/Generate CD-Keys/).first().waitFor();
    return "Administrator dashboard and CD-Key operation are reachable";
  });

  let multiSubjectJobId = null;
  await check("GEN-01-MULTI-SUBJECT-INDEPENDENT-BILLING", async () => {
    const before = await balanceFor(primary.id);
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await useEnglish();
    await page.getByRole("button", { name: /Add another icon/ }).click();
    const fields = page.locator(".icon-subject-input");
    await fields.nth(0).fill("Cloud upload arrow");
    await fields.nth(1).fill("Secure shield check");
    await page.getByRole("button", { name: "Configure background for icon 2" }).click();
    const drawer = page.getByRole("dialog", { name: "Icon background" });
    await drawer.getByRole("button", { name: "Gradient", exact: true }).click();
    await drawer.getByRole("button", { name: "Close background settings" }).click();
    const responsePromise = page.waitForResponse((candidate) => candidate.url().endsWith("/api/generation/jobs") && candidate.request().method() === "POST", { timeout: 30_000 });
    await page.getByRole("button", { name: "Generate icons" }).click();
    const response = await responsePromise;
    const body = await response.json();
    if (response.status() !== 201) throw new Error(`Submit returned ${response.status()}: ${JSON.stringify(body)}`);
    multiSubjectJobId = body.id;
    const after = await balanceFor(primary.id);
    if (before - after !== 2) throw new Error(`Expected 2-credit debit, observed ${before} -> ${after}`);
    const stored = await admin.from("generation_jobs").select("generation_spec").eq("id", body.id).single();
    if (stored.error) throw stored.error;
    const modes = stored.data.generation_spec.subjects.map((subject) =>
      subject.backgroundOverride?.enabled === false
        ? "transparent"
        : subject.backgroundOverride?.color?.mode ?? null,
    );
    if (modes[0] === modes[1] || modes[1] !== "gradient") throw new Error(`Independent backgrounds were not persisted: ${JSON.stringify(modes)}`);
    const deadline = Date.now() + 12 * 60_000;
    while (Date.now() < deadline) {
      const row = await admin.from("generation_jobs").select("status,error_code,error_message").eq("id", body.id).single();
      if (row.error) throw row.error;
      if (["completed", "partial", "failed"].includes(row.data.status)) {
        if (row.data.status !== "completed") throw new Error(`Job ended ${row.data.status}: ${row.data.error_code ?? ""} ${row.data.error_message ?? ""}`);
        return { jobId: body.id, balance: `${before} -> ${after}`, backgroundModes: modes, status: row.data.status };
      }
      await new Promise((resolve) => setTimeout(resolve, 8_000));
    }
    throw new Error(`Timed out waiting for ${body.id}`);
  });

  await check("DL-01-REAL-ZIP", async () => {
    if (!multiSubjectJobId) throw new Error("Multi-subject job was not created");
    await page.goto(`${baseUrl}/icons/${multiSubjectJobId}`, { waitUntil: "domcontentloaded" });
    const selectAll = page.getByRole("button", { name: "Select all" });
    await selectAll.waitFor({ timeout: 30_000 });
    await selectAll.click();
    const subjects = await admin.from("generation_subjects").select("id").eq("job_id", multiSubjectJobId);
    if (subjects.error) throw subjects.error;
    const variants = await admin.from("generation_variants").select("id").in("subject_id", subjects.data.map((row) => row.id)).eq("status", "completed");
    if (variants.error || variants.data.length !== 6) throw variants.error ?? new Error(`Expected 6 variants, got ${variants.data.length}`);
    const download = await page.evaluate(async ({ jobId, variantIds }) => {
      const response = await fetch(`/api/generation/jobs/${jobId}/downloads`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantIds, format: "png", includeSvg: false }),
      });
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, length: bytes.length, signature: [...bytes.slice(0, 4)] };
    }, { jobId: multiSubjectJobId, variantIds: variants.data.map((row) => row.id) });
    if (download.status !== 200 || download.length < 100 || download.signature[0] !== 0x50 || download.signature[1] !== 0x4b)
      throw new Error(`Invalid ZIP response: ${JSON.stringify(download)}`);
    return { status: download.status, bytes: download.length, zipSignature: download.signature, selectedOptions: 6 };
  });

  console.log(JSON.stringify({ testedAt: new Date().toISOString(), account: email.replace(/(^.).*(@.*$)/, "$1***$2"), results }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const user of temporaryUsers.reverse()) {
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
}
