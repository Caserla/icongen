import assert from "node:assert/strict";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const email = process.env.E2E_TEST_EMAIL ?? "04102198q@163.com";
const detailJobId = process.env.E2E_DETAIL_JOB_ID ?? "13c72d16-169b-4f49-94d0-49d26a49ed17";
const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });

try {
  let perAssetPreviewRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/generation\/assets\/[^/]+\/preview/.test(request.url()))
      perAssetPreviewRequests += 1;
  });
  const listStartedAt = performance.now();
  const listResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/generation/jobs/list"));
  await page.goto(`${baseUrl}/icons?usage=illustration`, { waitUntil: "domcontentloaded" });
  const listResponse = await listResponsePromise;
  const serverTiming = await listResponse.headerValue("server-timing");
  const listApiMs = Math.round(performance.now() - listStartedAt);
  await page.waitForSelector(".icons-filter-option");
  await page.locator(".icon-library-card").first().waitFor({ state: "visible" });
  const firstCardMs = Math.round(performance.now() - listStartedAt);
  await page.locator('.icon-library-card [data-image-state="loaded"]').first().waitFor({ state: "visible" });
  const firstImageMs = Math.round(performance.now() - listStartedAt);
  assert.equal(perAssetPreviewRequests, 0, "the normal list path uses batch-signed image URLs instead of per-image proxy requests");
  const initialProxyCount = perAssetPreviewRequests;
  const cachedListTiming = await page.evaluate(async () => {
    const response = await fetch("/api/generation/jobs/list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ page: 1, usage: "illustration" }),
    });
    if (!response.ok) throw new Error(`cached list request failed: ${response.status}`);
    return response.headers.get("server-timing");
  });
  assert.match(cachedListTiming ?? "", /cache;desc=hit/, "a repeated list query uses the short private server cache");

  const flatPlayful = page
    .locator(".icons-filter-group")
    .nth(1)
    .getByRole("button", { name: /扁平活泼|Playful Flat/i });
  assert.notEqual(await flatPlayful.getAttribute("aria-current"), "page", "the style regression starts from a different filter");
  const styleRequestStartedAt = performance.now();
  const styleResponsePromise = page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/generation/jobs/list")) return false;
    return response.request().postData()?.includes('"style":"flat-playful"') ?? false;
  });
  await flatPlayful.click();
  const styleResponse = await styleResponsePromise;
  assert.equal(styleResponse.status(), 200, "switching styles completes a real list request");
  await page.locator('.icons-filter-option[aria-current="page"]').filter({ hasText: /扁平活泼|Playful Flat/i }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.icons-list-swap.is-updating'));
  const styleSwitchMs = Math.round(performance.now() - styleRequestStartedAt);

  let delayed = false;
  await page.route("**/api/generation/jobs/list", async (route) => {
    if (!delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    await route.continue();
  });
  const statusOptions = page.locator(".icons-filter-group").last().locator('.icons-filter-option:not([aria-current="page"])');
  await statusOptions.first().click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[aria-label="正在加载图标"], [aria-label="Loading icons"]').count(), 0, "fast transition must not flash a skeleton");
  await page.waitForTimeout(220);
  const loadingRegion = page.locator('[aria-label="正在加载图标"], [aria-label="Loading icons"]');
  assert.equal(await loadingRegion.count(), 0, "a slow filter keeps the existing cards instead of replacing them with skeletons");
  assert.ok((await page.locator(".icon-library-card").count()) > 0, "existing cards remain visible during a slow filter request");
  await page.waitForTimeout(650);

  await page.goto(`${baseUrl}/icons/${detailJobId}`, { waitUntil: "networkidle" });
  const cards = page.locator(".studio-result-card");
  assert.ok((await cards.count()) > 0, "generation details render option cards");
  const firstCompleted = cards.filter({ has: page.locator('button[aria-label*="方案"], button[aria-label*="option"]') }).first();
  await firstCompleted.click({ position: { x: 90, y: 90 } });
  await page.waitForTimeout(300);
  assert.ok((await page.locator(".studio-selection-check").count()) > 0, "selection check is rendered above the selected card");

  const adjust = page.getByRole("button", { name: /调整图标细节|Adjust icon details/i }).first();
  if (await adjust.count()) {
    await adjust.click();
    await page.waitForSelector(".variant-edit-studio");
    const comparison = page.locator(".variant-comparison");
    if (await comparison.count()) {
      const range = comparison.locator('input[type="range"]');
      await range.fill("28");
      assert.equal(await range.inputValue(), "28", "before/after comparison is draggable");
    }
  }
  console.log(`PASS list fast path (API ${listApiMs}ms, first card ${firstCardMs}ms, first image ${firstImageMs}ms, style switch ${styleSwitchMs}ms, ${initialProxyCount} list proxy requests; server: ${serverTiming ?? "unavailable"}; repeat: ${cachedListTiming}) and motion batch`);
} finally {
  await browser.close();
}
