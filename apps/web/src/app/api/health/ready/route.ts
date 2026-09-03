import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { healthcheckAuthorized } from "@/lib/security/healthcheck-auth";
import { serverLogger } from "@/lib/security/server-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.HEALTHCHECK_TOKEN;
  if (!healthcheckAuthorized(request.headers.get("x-healthcheck-token"), expected)) {
    return new Response(null, { status: expected ? 404 : 503 });
  }

  try {
    const check = createAdminSupabaseClient()
      .from("generation_runtime_limits")
      .select("singleton")
      .eq("singleton", true)
      .maybeSingle();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("readiness timeout")), 3000);
    });
    const result = await Promise.race([check, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
    if (result.error) throw result.error;
    return Response.json(
      { status: "ready", service: "icongen-web", database: "reachable" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    serverLogger.error("readiness_check_failed", { error });
    return Response.json(
      { status: "unavailable", service: "icongen-web" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
