import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv, requireServerEnv } from "@/lib/env";
import { isLocalMode } from "@/lib/local/mode";
import { createLocalClient } from "@/lib/local/database.mjs";

export function createAdminSupabaseClient() {
  if (isLocalMode()) return createLocalClient();
  const { supabaseUrl } = requirePublicSupabaseEnv();
  const { supabaseServiceRoleKey } = requireServerEnv();
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
