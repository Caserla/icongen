import { createClient } from "@supabase/supabase-js";

const [creditsArg, expiresArg, ...noteParts] = process.argv.slice(2);
const credits = Number(creditsArg);
const expiresAt = expiresArg && expiresArg !== "-" ? new Date(expiresArg) : null;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!Number.isSafeInteger(credits) || credits <= 0) {
  throw new Error("Usage: node scripts/create-cd-key.mjs <credits> [expires-at|-] [note]");
}
if (expiresAt && Number.isNaN(expiresAt.getTime())) {
  throw new Error("expires-at must be an ISO date or '-'.");
}
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data, error } = await supabase.rpc("create_credit_redemption_code", {
  p_credits: credits,
  p_expires_at: expiresAt?.toISOString() ?? null,
  p_note: noteParts.join(" ") || null,
});
if (error) throw error;

const result = Array.isArray(data) ? data[0] : data;
if (!result?.generated_code) throw new Error("The database did not return a CD-Key.");
console.log(JSON.stringify({
  code: result.generated_code,
  credits: result.granted_credits,
  expiresAt: result.expires_at,
}, null, 2));
