import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { openAuthenticatedBrowser } from "./e2e-browser-auth.mjs";

const email = process.argv[2];
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://esdesign.men";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !supabaseUrl || !serviceRoleKey) throw new Error("Email and Supabase environment are required");

const designs = [
  {
    style: "isometric-3d", name: "LOGIFLOW",
    description: "LOGIFLOW logistics logo: isometric depot, parcel route and truck form a delivery system on the left; keep upper-right space open; brand on the front platform; blue-teal gradient.",
    background: { enabled: true, container: "rounded-square", cornerRadius: 26, autoColor: false, color: { mode: "gradient", colors: ["#2457D6", "#24B5A5"], direction: "top-left-to-bottom-right" } },
  },
  {
    style: "neon", name: "VELORA",
    description: "VELORA EV logo: a neon charging arc links a car silhouette to a lightning plug; push the symbol upper left and set VELORA vertically at right; cyan-violet glow on navy.",
    background: { enabled: true, container: "square", autoColor: false, color: { mode: "gradient", colors: ["#04182E", "#35125C"], direction: "left-to-right" } },
  },
  {
    style: "low-poly", name: "NORTHPEAK",
    description: "NORTHPEAK navigation logo: a wide faceted mountain begins flush at the bottom edge and rises upper right with a compass trail; never float or center it; brand carved into the bottom ridge.",
    background: { enabled: true, container: "rounded-square", cornerRadius: 20, autoColor: false, color: { mode: "gradient", colors: ["#FF8A4C", "#2446A8"], direction: "bottom-to-top" } },
  },
  {
    style: "clay-3d", name: "NESTCARE",
    description: "NESTCARE telehealth logo: clay heart, speech bubble and medical cross form a caring consultation scene right of center; brand on a lower-left tablet; mint-peach circle.",
    background: { enabled: true, container: "circle", autoColor: false, color: { mode: "gradient", colors: ["#BCEBD8", "#FFD0C4"], direction: "top-to-bottom" } },
  },
  {
    style: "flat-playful", name: "SIPSPRINT",
    description: "SIPSPRINT hydration logo: playful reusable cup, sparkle and progress ring show reminders and daily tracking; cup at left, brand upper right; coral-lime rounded background.",
    background: { enabled: true, container: "rounded-square", cornerRadius: 30, autoColor: false, color: { mode: "gradient", colors: ["#FF735C", "#C9F45A"], direction: "bottom-to-top" } },
  },
  {
    style: "pixel-art", name: "VAULTBYTE",
    description: "VAULTBYTE cloud-security logo: pixel shield encloses a key and data blocks for encryption and backup; shield upper right, brand in a left-side HUD; indigo-black square.",
    background: { enabled: true, container: "square", autoColor: false, color: { mode: "gradient", colors: ["#4338CA", "#090C1A"], direction: "top-right-to-bottom-left" } },
  },
  {
    style: "flat-illustration", name: "SUNNEST",
    description: "SUNNEST home-energy logo: solar roof and battery must sit directly on and span the bottom edge, with sun rays growing upward; do not center or float the scene; place SUNNEST on the roof fascia.",
    background: { enabled: true, container: "rounded-square", cornerRadius: 18, autoColor: false, color: { mode: "gradient", colors: ["#66C7FF", "#FFE46B"], direction: "top-to-bottom" } },
  },
  {
    style: "cute-sticker", name: "MINTMATE",
    description: "MINTMATE dental logo: cheerful tooth holds a brush and sparkle for habit coaching; tilt the character lower right and arc MINTMATE above it; aqua-cream rounded background.",
    background: { enabled: true, container: "rounded-square", cornerRadius: 32, autoColor: false, color: { mode: "gradient", colors: ["#9DECE3", "#FFF4D8"], direction: "top-left-to-bottom-right" } },
  },
  {
    style: "minimal-logo", name: "EASY DESIGN",
    description: "EASY DESIGN logo: asymmetric E/D monogram combines layout block, pen nib and check; anchor the mark left and stack EASY DESIGN at lower right; black on warm-white rounded background.",
    background: { enabled: true, container: "rounded-square", cornerRadius: 24, autoColor: false, color: { mode: "solid", color: "#F4F1EA" } },
  },
];

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { browser, page } = await openAuthenticatedBrowser({ email, baseUrl });

async function submit(design) {
  const spec = {
    idempotencyKey: randomUUID(),
    settingsVersion: "icon-style-2026-08-25.23",
    purpose: "app-icon",
    subjects: [{ clientId: randomUUID(), name: design.name, description: design.description, backgroundOverride: design.background }],
    subjectColor: { mode: "solid", color: "#111111" },
    background: design.background,
    style: { preset: design.style, subjectSizePercent: 70, linearStrokeWidthPercent: 3.5, subjectOpacityPercent: 100, strokeWeight: "regular", cornerStyle: "balanced", detailLevel: "detailed" },
    sizes: [256],
  };
  return page.evaluate(async (payload) => {
    const response = await fetch("/api/generation/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) throw new Error(`${response.status} ${body.error ?? ""}: ${body.message ?? ""}`);
    return body.id;
  }, spec);
}

async function waitForTerminal(id) {
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    const result = await admin.from("generation_jobs").select("id,status,error_code,error_message").eq("id", id).single();
    if (result.error) throw result.error;
    if (["completed", "partial", "failed"].includes(result.data.status)) return result.data;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`Timed out waiting for ${id}`);
}

const results = [];
for (const design of designs) {
  const id = await submit(design);
  console.log(`submitted ${design.style} ${design.name} ${id}`);
  const terminal = await waitForTerminal(id);
  results.push({ style: design.style, brand: design.name, id, status: terminal.status, error: terminal.error_code ?? null });
  console.log(`finished ${design.style} ${terminal.status}`);
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
