import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const email = process.argv[2];
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !supabaseUrl || !serviceRoleKey) throw new Error("email and Supabase environment variables are required");
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });

async function openCreate() {
  await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Generate icons" }).waitFor({ timeout: 30_000 });
}
async function submit(subject) {
  await page.getByPlaceholder("Type what you want to create…").fill(subject);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/generation/jobs") && candidate.request().method() === "POST"),
    page.getByRole("button", { name: "Generate icons" }).click(),
  ]);
  const body = await response.json().catch(() => ({}));
  if (response.status() !== 201) throw new Error(`Submit returned ${response.status()} ${body.error ?? ""}`);
  await page.waitForURL(/\/icons\/[0-9a-f-]{36}$/i, { waitUntil: "domcontentloaded" });
  return body.id;
}
async function terminal(id) {
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const row = await admin.from("generation_jobs").select("id,status,error_code,error_message,generation_spec").eq("id", id).single();
    if (row.error) throw row.error;
    if (["completed", "partial", "failed"].includes(row.data.status)) return row.data;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`Timed out waiting for ${id}`);
}

await openCreate();
await page.getByRole("button", { name: "Filled" }).click();
await page.getByRole("button", { name: "Color value", exact: true }).click();
const opacity = page.getByRole("slider", { name: "Color value opacity" });
await opacity.fill("45");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Configure background for icon 1" }).click();
await page.getByRole("button", { name: "None", exact: true }).click();
await page.getByRole("button", { name: "Close background settings" }).click();
await page.getByRole("button", { name: "64 × 64" }).click();
await page.getByRole("button", { name: "128 × 128" }).click();
await page.getByRole("button", { name: "32 × 32" }).click();
const filledId = await submit("Filled notification bell");
const filled = await terminal(filledId);
const filledSpec = filled.generation_spec;
if (filledSpec.style.graphicStructure !== "filled" || filledSpec.style.subjectOpacityPercent !== 45 || filledSpec.subjects[0].backgroundOverride.enabled !== false)
  throw new Error("Filled transparent settings were not persisted");
if (JSON.stringify(filledSpec.sizes) !== JSON.stringify([32, 256])) throw new Error(`Unexpected sizes ${JSON.stringify(filledSpec.sizes)}`);

await openCreate();
await page.getByRole("button", { name: "Configure background for icon 1" }).click();
await page.getByRole("button", { name: "Gradient", exact: true }).click();
await page.getByRole("button", { name: "Square", exact: true }).click();
const start = page.getByRole("textbox", { name: "Start color HEX" });
const end = page.getByRole("textbox", { name: "End color HEX" });
await start.fill("#112233"); await start.press("Enter");
await end.fill("#AABBCC"); await end.press("Enter");
await page.locator("summary").filter({ hasText: "Gradient direction" }).click();
await page.getByRole("button", { name: "Left to right", exact: true }).click();
const previewStyle = await page.getByLabel("Live background preview image").getAttribute("style");
if (!previewStyle?.includes("linear-gradient(to right") || !previewStyle.includes("rgb(17, 34, 51)"))
  throw new Error(`Preview did not synchronize gradient: ${previewStyle}`);
await page.getByRole("button", { name: "Close background settings" }).click();
const gradientId = await submit("Linear cloud upload arrow");
const gradient = await terminal(gradientId);
const gradientBackground = gradient.generation_spec.subjects[0].backgroundOverride;
if (gradient.generation_spec.style.graphicStructure !== "linear" || !gradientBackground.enabled || gradientBackground.container !== "square" || gradientBackground.color.direction !== "left-to-right")
  throw new Error("Gradient settings were not persisted");
if (JSON.stringify(gradientBackground.color.colors) !== JSON.stringify(["#112233", "#AABBCC"]))
  throw new Error(`Unexpected gradient colors ${JSON.stringify(gradientBackground.color.colors)}`);

await browser.close();
console.log(JSON.stringify({
  filledTransparent: { id: filledId, status: filled.status, subjectOpacityPercent: filledSpec.style.subjectOpacityPercent, sizes: filledSpec.sizes, background: filledSpec.subjects[0].backgroundOverride },
  linearGradient: { id: gradientId, status: gradient.status, previewSynchronized: true, background: gradientBackground },
}, null, 2));
