import { createClient } from "@supabase/supabase-js";

const [email, creditsArg = "100"] = process.argv.slice(2);
const credits = Number(creditsArg);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !Number.isSafeInteger(credits) || credits <= 0)
  throw new Error("Usage: node scripts/test-cd-key-topup.mjs <email> [credits]");
if (!supabaseUrl || !anonKey || !serviceRoleKey)
  throw new Error("Supabase URL, anon key, and service-role key are required.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let page = 1;
let user;
while (!user) {
  const listed = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (listed.error) throw listed.error;
  user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (user || listed.data.users.length < 100) break;
  page += 1;
}
if (!user) throw new Error(`Account not found: ${email}`);

const before = await admin.from("credit_accounts").select("balance").eq("user_id", user.id).single();
if (before.error) throw before.error;

const created = await admin.rpc("create_credit_redemption_code", {
  p_credits: credits,
  p_expires_at: null,
  p_note: `Automated E2E test top-up ${new Date().toISOString()}`,
});
if (created.error) throw created.error;
const generated = Array.isArray(created.data) ? created.data[0] : created.data;
if (!generated?.generated_code) throw new Error("CD-Key creation returned no code.");

const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
if (link.error) throw link.error;
const tokenHash = link.data.properties?.hashed_token;
if (!tokenHash) throw new Error("Could not create the test user session.");
const verified = await authClient.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
if (verified.error || !verified.data.session) throw verified.error ?? new Error("Could not verify test user session.");

const userClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${verified.data.session.access_token}` } },
});
const first = await userClient.rpc("redeem_credit_code", { p_code: generated.generated_code });
if (first.error) throw first.error;
const firstResult = Array.isArray(first.data) ? first.data[0] : first.data;

const duplicate = await userClient.rpc("redeem_credit_code", { p_code: generated.generated_code });
if (!duplicate.error?.message.includes("CD_KEY_ALREADY_REDEEMED"))
  throw new Error("Duplicate redemption was not rejected as expected.");

const [after, ledger] = await Promise.all([
  admin.from("credit_accounts").select("balance").eq("user_id", user.id).single(),
  admin.from("credit_ledger").select("id,entry_type,amount,balance_after,note,created_at")
    .eq("user_id", user.id).eq("entry_type", "cd_key_redemption")
    .order("created_at", { ascending: false }).limit(1).single(),
]);
if (after.error) throw after.error;
if (ledger.error) throw ledger.error;
if (after.data.balance !== before.data.balance + credits)
  throw new Error(`Balance mismatch: expected ${before.data.balance + credits}, received ${after.data.balance}`);
if (firstResult?.new_balance !== after.data.balance || ledger.data.balance_after !== after.data.balance || ledger.data.amount !== credits)
  throw new Error("Redemption response, account balance, and ledger do not agree.");

console.log(JSON.stringify({
  account: email.replace(/(^.).*(@.*$)/, "$1***$2"),
  credits,
  balanceBefore: before.data.balance,
  balanceAfter: after.data.balance,
  ledgerEntryType: ledger.data.entry_type,
  ledgerAmount: ledger.data.amount,
  duplicateRedemptionRejected: true,
  codeExposed: false,
}, null, 2));
