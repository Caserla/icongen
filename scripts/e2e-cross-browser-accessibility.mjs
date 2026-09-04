import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const email = process.argv[2];
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (!email) throw new Error("Usage: node scripts/e2e-cross-browser-accessibility.mjs <email>");

const results = [];
const browserNames = process.env.E2E_BROWSER ? [process.env.E2E_BROWSER] : ["chromium", "firefox", "webkit"];
for (const browserName of browserNames) {
  const session = await openAuthenticatedBrowser({ email, baseUrl, browserName });
  const { page, browser } = session;
  try {
    await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    if (!(await page.locator(".purpose-switch__option").count()))
      throw new Error(`${browserName}: create page did not finish loading: ${(await page.locator("body").innerText()).slice(-300)}`);
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    await page.waitForTimeout(200);
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (metrics.scrollWidth > metrics.clientWidth + 1)
      throw new Error(`${browserName}: horizontal overflow at 200% text size (${metrics.scrollWidth}/${metrics.clientWidth})`);

    await page.keyboard.press("Tab");
    let interactiveFocusCount = 0;
    for (let index = 0; index < 40; index += 1) {
      const focused = await page.evaluate(() => {
        const item = document.activeElement;
        if (!(item instanceof HTMLElement)) return null;
        return { tag: item.tagName, disabled: "disabled" in item && Boolean(item.disabled), visible: Boolean(item.offsetWidth || item.offsetHeight) };
      });
      if (focused?.visible && !focused.disabled && ["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(focused.tag))
        interactiveFocusCount += 1;
      await page.keyboard.press("Tab");
    }
    if (interactiveFocusCount < 8) throw new Error(`${browserName}: keyboard flow exposed only ${interactiveFocusCount} controls`);

    const illustration = page.locator(".purpose-switch__option").nth(1);
    await illustration.focus();
    await page.keyboard.press("Enter");
    if ((await illustration.getAttribute("aria-pressed")) !== "true")
      throw new Error(`${browserName}: icon type could not be changed by keyboard`);

    const subject = page.locator("textarea, input").filter({ hasNot: page.locator("[type=hidden]") }).first();
    await subject.focus();
    await page.keyboard.type("Keyboard accessible test icon");
    if (!(await subject.inputValue()).includes("Keyboard accessible"))
      throw new Error(`${browserName}: keyboard input failed`);
    results.push({ browserName, textZoom: "200%", horizontalOverflow: false, keyboardControls: interactiveFocusCount, keyboardToggle: true, keyboardInput: true });
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify(results, null, 2));
