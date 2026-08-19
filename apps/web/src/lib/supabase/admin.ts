import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv, requireServerEnv } from "@/lib/env";

export function createAdminSupabaseClient() {
  const { supabaseUrl } = requirePublicSupabaseEnv();
  const { supabaseServiceRoleKey } = requireServerEnv();
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

