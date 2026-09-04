const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function getServerEnv() {
  return serverEnv;
}

export function requirePublicSupabaseEnv() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  return { supabaseUrl: publicEnv.supabaseUrl, supabaseAnonKey: publicEnv.supabaseAnonKey };
}

export function requireServerEnv() {
  if (!serverEnv.supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return { ...serverEnv, supabaseServiceRoleKey: serverEnv.supabaseServiceRoleKey };
}
