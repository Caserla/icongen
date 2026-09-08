import { validateRuntimeEnvironment } from "@icongen/shared";

export const publicEnv = {
  appEnvironment: process.env.NEXT_PUBLIC_APP_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export function getServerEnv() {
  return { supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

export function requireRuntimeEnvironment() {
  const appEnvironment = process.env.APP_ENV ?? publicEnv.appEnvironment;
  if (
    process.env.APP_ENV &&
    publicEnv.appEnvironment &&
    process.env.APP_ENV !== publicEnv.appEnvironment
  ) {
    throw new Error(
      `APP_ENV ${process.env.APP_ENV} does not match NEXT_PUBLIC_APP_ENV ${publicEnv.appEnvironment}`,
    );
  }
  return validateRuntimeEnvironment({
    appEnvironment,
    nodeEnvironment: process.env.NODE_ENV,
    resourceEnvironment: process.env.SUPABASE_ENVIRONMENT,
    appUrl: publicEnv.appUrl,
    imageProvider: process.env.IMAGE_PROVIDER,
  });
}

export function isPublicSignupEnabled() {
  if (process.env.PUBLIC_SIGNUP_ENABLED === "true") return true;
  if (process.env.PUBLIC_SIGNUP_ENABLED === "false") return false;
  const environment = requireRuntimeEnvironment();
  return environment === "development" || environment === "test";
}

export function requirePublicSupabaseEnv() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }
  return {
    supabaseUrl: publicEnv.supabaseUrl,
    supabaseAnonKey: publicEnv.supabaseAnonKey,
  };
}

export function requireServerEnv() {
  const serverEnv = getServerEnv();
  requireRuntimeEnvironment();
  if (!serverEnv.supabaseServiceRoleKey)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return {
    ...serverEnv,
    supabaseServiceRoleKey: serverEnv.supabaseServiceRoleKey,
  };
}
