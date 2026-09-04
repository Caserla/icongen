import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("shared loading and image failure states follow the selected locale", async () => {
  const [skeletons, image] = await Promise.all([
    source("components/ui/page-skeletons.tsx"),
    source("components/ui/image-with-skeleton.tsx"),
  ]);
  assert.match(skeletons, /Loading icon generator/);
  assert.match(skeletons, /Loading my icons/);
  assert.match(skeletons, /Loading generation results/);
  assert.match(image, /Image failed to load/);
  assert.match(skeletons, /useLocale/);
  assert.match(image, /useLocale/);
});

test("admin navigation, panels, empty states, and errors provide English copy", async () => {
  const [layout, header, dashboard] = await Promise.all([
    source("app/(admin)/admin/layout.tsx"),
    source("features/admin/components/admin-header.tsx"),
    source("features/admin/components/admin-dashboard.tsx"),
  ]);
  assert.doesNotMatch(layout, /管理后台|返回产品/);
  for (const copy of [
    "Admin console",
    "Back to product",
    "Operations console",
    "Refresh data",
    "Generation jobs",
    "No data yet",
    "Reload",
    "Generate CD-Keys",
  ]) {
    assert.ok(`${header}\n${dashboard}`.includes(copy), `missing English admin copy: ${copy}`);
  }
});

test("new CD-Keys are visible and exportable during their one-time reveal", async () => {
  const dashboard = await source(
    "features/admin/components/admin-dashboard.tsx",
  );

  assert.match(dashboard, /value=\{codes\.join\("\\n"\)\}/);
  assert.match(dashboard, /navigator\.clipboard\.writeText/);
  assert.match(dashboard, /Export CSV/);
  assert.match(dashboard, /Shown once/);
});
