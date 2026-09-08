import { chromium, firefox, webkit } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createChunks } from "@supabase/ssr";

export async function openAuthenticatedBrowser({
  email,
  baseUrl = "http://127.0.0.1:3000",
  headless = true,
  browserName = "chromium",
} = {}) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !supabaseUrl || !serviceRoleKey)
    throw new Error("email and Supabase environment variables are required");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${baseUrl}/auth/callback?next=/create` },
  });
  if (generated.error) throw generated.error;
  const tokenHash = generated.data.properties?.hashed_token;
  if (!tokenHash) throw new Error("Supabase did not return an authentication token");
  const verifier = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await verifier.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verified.error || !verified.data.session)
    throw verified.error ?? new Error("Could not establish a test session");

  const engines = { chromium, firefox, webkit };
  const engine = engines[browserName];
  if (!engine) throw new Error(`Unsupported browser engine: ${browserName}`);
  const browser = await engine.launch({
    headless,
    ...(browserName === "chromium" && process.env.E2E_USE_EDGE === "1"
      ? { executablePath: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" }
      : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const encodedSession = `base64-${Buffer.from(JSON.stringify(verified.data.session)).toString("base64url")}`;
  await context.addCookies(createChunks(`sb-${projectRef}-auth-token`, encodedSession).map((cookie) => ({
    ...cookie,
    url: baseUrl,
    httpOnly: false,
    secure: new URL(baseUrl).protocol === "https:",
    sameSite: "Lax",
  })));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(`${baseUrl}/create`, { timeout: 30_000 });
  return { admin, browser, context, page };
}
