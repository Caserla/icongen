import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const approvedAdminConsumers = new Set([
  "src/app/api/admin/audit/query/route.ts",
  "src/app/api/admin/cd-keys/batches/[batchId]/disable/route.ts",
  "src/app/api/admin/cd-keys/batches/route.ts",
  "src/app/api/admin/cd-keys/query/route.ts",
  "src/app/api/admin/jobs/query/route.ts",
  "src/app/api/admin/overview/route.ts",
  "src/app/api/admin/users/query/route.ts",
  "src/app/api/health/ready/route.ts",
  "src/app/api/generation/assets/[assetId]/preview/route.ts",
  "src/app/api/generation/jobs/[jobId]/downloads/route.ts",
  "src/app/api/generation/jobs/[jobId]/route.ts",
  "src/app/api/generation/jobs/[jobId]/summary/route.ts",
  "src/app/api/generation/jobs/list/route.ts",
  "src/app/api/generation/variant-revisions/[revisionId]/assets/[assetId]/preview/route.ts",
  "src/app/api/generation/variants/[variantId]/edits/[editId]/apply/route.ts",
  "src/app/api/generation/variants/[variantId]/edits/[editId]/route.ts",
  "src/app/api/generation/variants/[variantId]/edits/route.ts",
  "src/app/api/generation/variants/[variantId]/restore/route.ts",
  "src/app/api/generation/variants/[variantId]/retry/route.ts",
  "src/features/generation/server/local-generation-runner.ts",
]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : [target];
  }));
  return nested.flat().filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
}

test("service-role client usage stays inside the reviewed mutation allowlist", async () => {
  const root = path.resolve(process.cwd(), "src");
  const consumers: string[] = [];
  for (const file of await sourceFiles(root)) {
    if (file.endsWith("admin.ts") || file.endsWith(".test.ts")) continue;
    if ((await readFile(file, "utf8")).includes("createAdminSupabaseClient")) {
      consumers.push(path.relative(process.cwd(), file));
    }
  }
  assert.deepEqual(consumers.sort(), [...approvedAdminConsumers].sort());
});
