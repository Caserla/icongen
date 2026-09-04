import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const [templateOwnerEmail, templateJobId] = process.argv.slice(2);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!templateOwnerEmail || !templateJobId || !supabaseUrl || !serviceRoleKey)
  throw new Error("Usage: node scripts/e2e-paid-detail-edit-refund.mjs <template-owner-email> <template-job-id>");
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
let fixtureUserId = null;
let browser = null;

async function balance(userId) {
  const result = await admin.from("credit_accounts").select("balance").eq("user_id", userId).single();
  if (result.error) throw result.error;
  return result.data.balance;
}

try {
  const template = await admin.from("generation_jobs").select("generation_spec,skill_version").eq("id", templateJobId).single();
  if (template.error) throw template.error;
  const templateSubjects = await admin.from("generation_subjects").select("id").eq("job_id", templateJobId).limit(1);
  if (templateSubjects.error || !templateSubjects.data.length) throw templateSubjects.error ?? new Error("Template job has no subject");
  const templateVariants = await admin.from("generation_variants").select("id").eq("subject_id", templateSubjects.data[0].id).eq("status", "completed").limit(1);
  if (templateVariants.error || !templateVariants.data.length) throw templateVariants.error ?? new Error("Template job has no completed variant");
  const templateAsset = await admin.from("generation_assets").select("storage_bucket,storage_path,size,width,height,has_alpha")
    .eq("variant_id", templateVariants.data[0].id).eq("format", "png").order("size", { ascending: false }).limit(1).single();
  if (templateAsset.error) throw templateAsset.error;
  const downloaded = await admin.storage.from(templateAsset.data.storage_bucket).download(templateAsset.data.storage_path);
  if (downloaded.error) throw downloaded.error;
  const fixtureBytes = new Uint8Array(await downloaded.data.arrayBuffer());

  const fixtureEmail = `e2e-paid-edit-${randomUUID()}@example.invalid`;
  const createdUser = await admin.auth.admin.createUser({ email: fixtureEmail, email_confirm: true });
  if (createdUser.error) throw createdUser.error;
  fixtureUserId = createdUser.data.user.id;
  const funded = await admin.from("credit_accounts").update({ balance: 5 }).eq("user_id", fixtureUserId);
  if (funded.error) throw funded.error;
  const sourceSpec = structuredClone(template.data.generation_spec);
  sourceSpec.subjects = [{ ...sourceSpec.subjects[0], clientId: "paid-edit-fixture", name: "Paid edit fixture", description: "Dedicated paid detail adjustment failure fixture" }];
  const createdJob = await admin.rpc("create_generation_job_v2", {
    p_user_id: fixtureUserId, p_spec: sourceSpec,
    p_skill_version: template.data.skill_version ?? "2.0.0", p_idempotency_key: randomUUID(),
  });
  if (createdJob.error) throw createdJob.error;
  const jobId = createdJob.data;
  const subject = await admin.from("generation_subjects").select("id").eq("job_id", jobId).single();
  if (subject.error) throw subject.error;
  const variants = await admin.from("generation_variants").select("id,slot").eq("subject_id", subject.data.id).order("slot");
  if (variants.error) throw variants.error;
  const completedAt = new Date().toISOString();
  await admin.from("generation_jobs").update({ status: "completed", progress_percent: 100, progress_phase: "completed", completed_at: completedAt }).eq("id", jobId);
  await admin.from("generation_subjects").update({ status: "completed" }).eq("id", subject.data.id);
  for (const variant of variants.data) {
    await admin.from("generation_variants").update({ status: "completed", completed_at: completedAt }).eq("id", variant.id);
    const path = `${fixtureUserId}/${jobId}/variant-${variant.slot}/source.png`;
    const uploaded = await admin.storage.from("generated-icons").upload(path, fixtureBytes, { contentType: "image/png", upsert: true });
    if (uploaded.error) throw uploaded.error;
    const asset = await admin.from("generation_assets").insert({
      variant_id: variant.id, size: templateAsset.data.size, width: templateAsset.data.width,
      height: templateAsset.data.height, has_alpha: templateAsset.data.has_alpha,
      storage_bucket: "generated-icons", storage_path: path, asset_role: "source", format: "png", mime_type: "image/png",
    });
    if (asset.error) throw asset.error;
  }
  const variant = variants.data[0];
  const history = [1, 2, 3].map((revisionNumber) => ({
    variant_id: variant.id, revision_number: revisionNumber,
    instruction: `Completed free adjustment ${revisionNumber}`,
    status: "completed", assets: [], completed_at: completedAt, updated_at: completedAt,
  }));
  const insertedHistory = await admin.from("generation_variant_revisions").insert(history);
  if (insertedHistory.error) throw insertedHistory.error;

  const balanceBefore = await balance(fixtureUserId);
  const created = await admin.rpc("create_variant_detail_edit_v2", {
    p_user_id: fixtureUserId, p_variant_id: variant.id,
    p_instruction: "Controlled paid adjustment failure for refund verification", p_idempotency_key: randomUUID(),
  });
  if (created.error) throw created.error;
  const editId = created.data?.id;
  if (!editId || created.data.chargedCredits !== 1) throw new Error(`Expected a charged edit, received ${JSON.stringify(created.data)}`);
  if (await balance(fixtureUserId) !== balanceBefore - 1) throw new Error("Paid edit was not debited before processing");
  const workerExit = await new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "process-edit", "--workspace=@icongen/icon-worker", "--", editId], {
      cwd: process.cwd(), env: { ...process.env, SUPABASE_URL: supabaseUrl, NODE_ENV: "test", E2E_INJECT_DETAIL_EDIT_FAILURE: "1", E2E_DETAIL_EDIT_FAILURE_ID: editId }, stdio: "ignore",
    });
    child.once("error", reject); child.once("exit", resolve);
  });
  if (workerExit === 0) throw new Error("Controlled failure worker unexpectedly succeeded");
  const revision = await admin.from("generation_variant_revisions").select("status,credit_charged_at,credit_refunded_at").eq("id", editId).single();
  if (revision.error || revision.data.status !== "failed" || !revision.data.credit_charged_at || !revision.data.credit_refunded_at)
    throw revision.error ?? new Error(`Failed revision did not settle correctly: ${JSON.stringify(revision.data)}`);
  if (await balance(fixtureUserId) !== balanceBefore) throw new Error("Failed paid edit was not refunded");
  const secondRefund = await admin.rpc("refund_failed_variant_detail_edit_v2", { p_revision_id: editId });
  if (secondRefund.error || secondRefund.data !== false) throw secondRefund.error ?? new Error("Duplicate refund was not idempotent");

  const session = await openAuthenticatedBrowser({ email: fixtureEmail, baseUrl });
  browser = session.browser;
  await session.page.goto(`${baseUrl}/icons/${jobId}`, { waitUntil: "domcontentloaded" });
  await session.page.getByRole("button", { name: /Adjust details|细节调整/ }).first().click();
  await session.page.getByText(/Detail adjustment failed|细节调整生成失败/).waitFor({ timeout: 30_000 });
  console.log(JSON.stringify({ dedicatedFixture: true, jobId, variantId: variant.id, editId, charged: 1, refunded: 1, duplicateRefundIdempotent: true, failureVisibleInBrowser: true }, null, 2));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (fixtureUserId) await admin.auth.admin.deleteUser(fixtureUserId);
}
