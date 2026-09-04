import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const [email, jobId] = process.argv.slice(2);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !jobId || !supabaseUrl || !serviceRoleKey)
  throw new Error("Usage: node scripts/e2e-browser-races-and-recovery.mjs <email> <completed-job-id>");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = await admin.auth.admin.listUsers({ perPage: 100 });
if (users.error) throw users.error;
const user = users.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error("Test user was not found");
const originalJob = await admin.from("generation_jobs")
  .select("status,progress_percent,progress_phase,updated_at,completed_at")
  .eq("id", jobId).eq("user_id", user.id).single();
if (originalJob.error) throw originalJob.error;
const subjects = await admin.from("generation_subjects").select("id").eq("job_id", jobId).order("position");
if (subjects.error || !subjects.data.length) throw subjects.error ?? new Error("Job has no subjects");
const variants = await admin.from("generation_variants")
  .select("id,active_revision_id,status")
  .in("subject_id", subjects.data.map(({ id }) => id)).eq("status", "completed");
if (variants.error || !variants.data.length) throw variants.error ?? new Error("Job has no completed variant");
const variant = variants.data[0];
const originalActiveRevisionId = variant.active_revision_id;
const maxRevision = await admin.from("generation_variant_revisions")
  .select("revision_number").eq("variant_id", variant.id).order("revision_number", { ascending: false }).limit(1);
if (maxRevision.error) throw maxRevision.error;
const startNumber = (maxRevision.data[0]?.revision_number ?? 0) + 1;
const revisionA = randomUUID();
const revisionB = randomUUID();
const now = new Date().toISOString();
const fixtureRows = [
  { id: revisionA, variant_id: variant.id, parent_revision_id: originalActiveRevisionId, revision_number: startNumber, instruction: "Race fixture current revision", status: "completed", assets: [], completed_at: now, updated_at: now },
  { id: revisionB, variant_id: variant.id, parent_revision_id: revisionA, revision_number: startNumber + 1, instruction: "Race fixture pending revision", status: "completed", assets: [], completed_at: now, updated_at: now },
];

let session;
let recoveryUserId = null;
try {
  const inserted = await admin.from("generation_variant_revisions").insert(fixtureRows);
  if (inserted.error) throw inserted.error;
  const activated = await admin.from("generation_variants").update({ active_revision_id: revisionA }).eq("id", variant.id);
  if (activated.error) throw activated.error;

  session = await openAuthenticatedBrowser({ email, baseUrl });
  const { browser, context } = session;
  const [adoptPage, restorePage] = [session.page, await context.newPage()];
  await Promise.all([
    adoptPage.goto(`${baseUrl}/icons/${jobId}`, { waitUntil: "domcontentloaded" }),
    restorePage.goto(`${baseUrl}/icons/${jobId}`, { waitUntil: "domcontentloaded" }),
  ]);
  await Promise.all([adoptPage.waitForTimeout(500), restorePage.waitForTimeout(500)]);
  await adoptPage.evaluate(({ variantId, editId }) => {
    const button = document.createElement("button");
    button.id = "e2e-adopt";
    button.textContent = "Adopt test revision";
    button.style.cssText = "position:fixed;inset:10px auto auto 10px;z-index:2147483647";
    button.onclick = async () => {
      const response = await fetch(`/api/generation/variants/${variantId}/edits/${editId}/apply`, { method: "POST" });
      document.body.dataset.e2eResult = String(response.status);
    };
    document.body.append(button);
  }, { variantId: variant.id, editId: revisionB });
  await restorePage.evaluate(({ variantId, expectedActiveRevisionId }) => {
    const button = document.createElement("button");
    button.id = "e2e-restore";
    button.textContent = "Restore test revision";
    button.style.cssText = "position:fixed;inset:10px auto auto 10px;z-index:2147483647";
    button.onclick = async () => {
      const response = await fetch(`/api/generation/variants/${variantId}/restore`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedActiveRevisionId }),
      });
      document.body.dataset.e2eResult = String(response.status);
    };
    document.body.append(button);
  }, { variantId: variant.id, expectedActiveRevisionId: revisionA });
  await Promise.all([adoptPage.click("#e2e-adopt"), restorePage.click("#e2e-restore")]);
  await Promise.all([
    adoptPage.waitForFunction(() => document.body.dataset.e2eResult),
    restorePage.waitForFunction(() => document.body.dataset.e2eResult),
  ]);
  const statuses = await Promise.all([
    adoptPage.evaluate(() => Number(document.body.dataset.e2eResult)),
    restorePage.evaluate(() => Number(document.body.dataset.e2eResult)),
  ]);
  if ([...statuses].sort().join(",") !== "200,409")
    throw new Error(`Expected one winner and one stale-tab conflict, got ${statuses.join(",")}`);

  await admin.from("generation_variants").update({ active_revision_id: originalActiveRevisionId }).eq("id", variant.id);
  await admin.from("generation_variant_revisions").delete().in("id", [revisionA, revisionB]);

  const recoveryEmail = `e2e-recovery-${randomUUID()}@example.invalid`;
  const recoveryUser = await admin.auth.admin.createUser({ email: recoveryEmail, email_confirm: true });
  if (recoveryUser.error) throw recoveryUser.error;
  recoveryUserId = recoveryUser.data.user.id;
  const funded = await admin.from("credit_accounts").update({ balance: 2 }).eq("user_id", recoveryUserId);
  if (funded.error) throw funded.error;
  const recoveryJob = await admin.rpc("create_generation_job_v2", {
    p_user_id: recoveryUserId,
    p_spec: {
      settingsVersion: "2.0.0", purpose: "interaction", style: "flat-playful", sizes: [64],
      subjects: [{ clientId: "recovery-subject", name: "Recovery", description: "Network recovery fixture" }],
    },
    p_skill_version: "2.0.0", p_idempotency_key: randomUUID(),
  });
  if (recoveryJob.error) throw recoveryJob.error;
  const recoveryJobId = recoveryJob.data;
  await admin.from("generation_jobs").update({
    status: "processing", progress_phase: "generating", progress_percent: 25,
    worker_lease_owner: "e2e-network-recovery",
    worker_lease_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 60_000).toISOString(),
  }).eq("id", recoveryJobId);
  await browser.close();
  session = await openAuthenticatedBrowser({ email: recoveryEmail, baseUrl });
  const recoveryPage = session.page;
  const recoveryContext = session.context;
  await recoveryPage.goto(`${baseUrl}/icons/${recoveryJobId}`, { waitUntil: "domcontentloaded" });
  const english = recoveryPage.getByRole("button", { name: "EN", exact: true });
  if ((await english.getAttribute("aria-pressed")) !== "true") await english.click();
  const statusPattern = `**/api/generation/jobs/${recoveryJobId}`;
  await recoveryPage.route(statusPattern, (route) => route.abort("internetdisconnected"));
  await recoveryContext.setOffline(true);
  await recoveryPage.waitForTimeout(11_000);
  await recoveryPage.getByText("Unable to retrieve the latest status", { exact: true }).waitFor({ timeout: 5_000 });
  const readClock = async () => {
    const body = await recoveryPage.locator("body").innerText();
    const match = body.match(/Updated \d+s ago|\d+ seconds? since last update/);
    if (!match) throw new Error(`Visible page clock was not found: ${body.slice(0, 700)}`);
    return match[0];
  };
  const clockBefore = await readClock();
  await recoveryPage.waitForTimeout(2_000);
  const clockAfter = await readClock();
  if (clockBefore === clockAfter) throw new Error("Visible page clock stopped while offline");
  await admin.from("generation_jobs").update({ updated_at: new Date().toISOString() }).eq("id", recoveryJobId);
  const recoveredResponse = recoveryPage.waitForResponse((response) =>
    response.url().includes(`/api/generation/jobs/${recoveryJobId}`) && response.status() === 200,
  { timeout: 15_000 });
  await recoveryPage.unroute(statusPattern);
  await recoveryContext.setOffline(false);
  await recoveredResponse;
  await recoveryPage.getByText("Unable to retrieve the latest status", { exact: true }).waitFor({ state: "hidden", timeout: 8_000 });
  console.log(JSON.stringify({
    dualTabAdoptRestore: { statuses, passed: true },
    offlineRecovery: { clockBefore, clockAfter, automaticRefresh: true, warningCleared: true },
  }, null, 2));
  await session.browser.close();
  session = null;
} finally {
  if (session) await session.browser.close().catch(() => {});
  await admin.from("generation_variants").update({ active_revision_id: originalActiveRevisionId }).eq("id", variant.id);
  await admin.from("generation_variant_revisions").delete().in("id", [revisionA, revisionB]);
  await admin.from("generation_jobs").update(originalJob.data).eq("id", jobId);
  if (recoveryUserId) await admin.auth.admin.deleteUser(recoveryUserId);
}
