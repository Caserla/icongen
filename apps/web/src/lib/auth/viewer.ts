import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type Viewer = { email: string; name: string; isAdmin: boolean };

export async function getOptionalViewer(): Promise<Viewer | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email) return null;
    const profile = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", data.user.id)
      .maybeSingle();
    return {
      email: data.user.email,
      name:
        profile.data?.display_name?.trim() || emailAccountName(data.user.email),
      isAdmin: data.user.app_metadata?.role === "admin",
    };
  } catch {
    return null;
  }
}

export function emailAccountName(email: string) {
  return email.split("@")[0] || "Bamboo user";
}
