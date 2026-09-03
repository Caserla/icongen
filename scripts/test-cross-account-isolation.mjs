import assert from "node:assert/strict";
import {
  authenticatedClient, createAdmin, createJob, createTestIdentity,
  loadStagingSecurityConfig, removeTestIdentity, setBalance,
} from "./lib/staging-security-test.mjs";

const config = loadStagingSecurityConfig();
const admin = createAdmin(config);
const identities = [];
const objectPath = `security-tests/${Date.now()}-owner-only.png`;
try {
  const owner = await createTestIdentity(admin, "owner"); identities.push(owner);
  const stranger = await createTestIdentity(admin, "stranger"); identities.push(stranger);
  await setBalance(admin, owner.id, 3);
  const jobId = await createJob(admin, owner.id, 1);
  const subject = await admin.from("generation_subjects").select("id").eq("job_id", jobId).single();
  if (subject.error) throw subject.error;
  const variant = await admin.from("generation_variants").select("id").eq("subject_id", subject.data.id).eq("slot", 1).single();
  if (variant.error) throw variant.error;
  const uploaded = await admin.storage.from("generated-icons").upload(objectPath, new Uint8Array([137, 80, 78, 71]), { contentType: "image/png" });
  if (uploaded.error) throw uploaded.error;
  const asset = await admin.from("generation_assets").insert({
    variant_id: variant.data.id, asset_role: "preview", format: "png", mime_type: "image/png",
    size: 512, width: 1, height: 1, has_alpha: true, storage_bucket: "generated-icons", storage_path: objectPath,
  });
  if (asset.error) throw asset.error;

  const ownerClient = await authenticatedClient(config, owner);
  const strangerClient = await authenticatedClient(config, stranger);
  for (const [table, column, value] of [
    ["generation_jobs", "id", jobId],
    ["generation_subjects", "id", subject.data.id],
    ["generation_variants", "id", variant.data.id],
    ["generation_assets", "variant_id", variant.data.id],
  ]) {
    const own = await ownerClient.from(table).select("*").eq(column, value);
    const foreign = await strangerClient.from(table).select("*").eq(column, value);
    if (own.error) throw own.error;
    if (foreign.error) throw foreign.error;
    assert.ok(own.data.length > 0, `${table}: owner should read own row`);
    assert.equal(foreign.data.length, 0, `${table}: foreign account must see no row`);
  }
  const ownObject = await ownerClient.storage.from("generated-icons").download(objectPath);
  assert.equal(ownObject.error, null, "owner should download owned object");
  const foreignObject = await strangerClient.storage.from("generated-icons").download(objectPath);
  assert.ok(foreignObject.error, "foreign account must not download owned object");
  const foreignSigned = await strangerClient.storage.from("generated-icons").createSignedUrl(objectPath, 60);
  assert.ok(foreignSigned.error, "foreign account must not sign owned object");
  console.log(JSON.stringify({ databaseRls: "passed", storageRls: "passed", signedUrlIsolation: "passed" }, null, 2));
} finally {
  await admin.storage.from("generated-icons").remove([objectPath]);
  for (const identity of identities.reverse()) await removeTestIdentity(admin, identity);
}
