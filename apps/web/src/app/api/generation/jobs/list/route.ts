import { ICON_STYLE_PRESET_IDS, type IconStylePresetId } from "@icongen/shared";
import { z } from "zod";
import { AuthError } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readGenerationJobs, readGenerationJobsRpc, type GenerationJobListPage, type GenerationJobListTimings, type GenerationJobStatusFilter } from "@/features/generation/server/generation-job-list-reader";

const listResponseCache = new Map<string, { result: GenerationJobListPage; expiresAt: number }>();
const MAX_LIST_CACHE_ENTRIES = 200;

const listRequestSchema = z.object({
  page: z.number().int().positive().max(100_000).default(1),
  usage: z.enum(["interaction", "illustration"]),
  style: z.string().optional(),
  structure: z.enum(["linear", "filled"]).optional(),
  status: z.enum(["in-progress", "completed", "partial", "failed"]).optional(),
});

export async function POST(request: Request) {
  const parsed = listRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_LIST_FILTER", "The icon list filter is invalid.", 400);
  try {
    const requestStartedAt = performance.now();
    const client = await createServerSupabaseClient();
    // `getUser()` performs a remote Auth request. The proxy has already done
    // that once for this protected route; verify the signed JWT locally here
    // and run the account-status check alongside the list query.
    const authStartedAt = performance.now();
    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    const authMs = Math.round(performance.now() - authStartedAt);
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
    if (claimsError || !userId)
      throw new AuthError("AUTH_REQUIRED", "Authentication is required.");
    if (claimsData?.claims?.email_verified === false)
      throw new AuthError("EMAIL_NOT_VERIFIED", "Email verification is required.");
    const requestedStyle = parsed.data.style;
    if (requestedStyle && !ICON_STYLE_PRESET_IDS.includes(requestedStyle as IconStylePresetId))
      return apiError("INVALID_LIST_FILTER", "The icon style filter is invalid.", 400);
    const stylePreset = requestedStyle && ICON_STYLE_PRESET_IDS.includes(requestedStyle as IconStylePresetId)
      ? requestedStyle as IconStylePresetId
      : undefined;
    if (stylePreset && (parsed.data.usage === "interaction" ? stylePreset !== "line-icon" : stylePreset === "line-icon"))
      return apiError("INVALID_LIST_FILTER", "The icon style does not match the requested icon type.", 400);
    const effectiveStyle = stylePreset && (parsed.data.usage === "interaction" ? stylePreset === "line-icon" : stylePreset !== "line-icon")
      ? stylePreset
      : undefined;
    const cacheKey = JSON.stringify([userId, parsed.data.page, parsed.data.usage, effectiveStyle, parsed.data.structure, parsed.data.status]);
    const cached = listResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now())
      return Response.json(cached.result, { headers: {
        "cache-control": "private, no-store",
        "server-timing": `auth;dur=${authMs}, cache;desc=hit;dur=0, total;dur=${Math.round(performance.now() - requestStartedAt)}`,
      } });
    if (cached) listResponseCache.delete(cacheKey);
    const timings: GenerationJobListTimings = {};
    const [profileResult, result] = await Promise.all([
      client.from("profiles").select("status").eq("id", userId).single(),
      process.env.GENERATION_LIST_RPC_ENABLED === "1" ? readGenerationJobsRpc(client, createAdminSupabaseClient(), {
        page: parsed.data.page,
        usage: parsed.data.usage,
        style: effectiveStyle,
        structure: parsed.data.usage === "interaction" ? parsed.data.structure : undefined,
        status: parsed.data.status as GenerationJobStatusFilter | undefined,
      }) : readGenerationJobs(client, userId, {
        page: parsed.data.page,
        usageFilter: parsed.data.usage,
        stylePreset: effectiveStyle,
        structureFilter: parsed.data.usage === "interaction" ? parsed.data.structure : undefined,
        statusFilter: parsed.data.status as GenerationJobStatusFilter | undefined,
      }, createAdminSupabaseClient(), timings),
    ]);
    if (profileResult.error || profileResult.data?.status !== "active")
      throw new AuthError("ACCOUNT_RESTRICTED", "This account cannot perform this operation.");
    const ttlMs = parsed.data.status === "completed" || parsed.data.status === "failed" ? 20_000 : 5_000;
    listResponseCache.set(cacheKey, { result, expiresAt: Date.now() + ttlMs });
    if (listResponseCache.size > MAX_LIST_CACHE_ENTRIES) {
      const oldestKey = listResponseCache.keys().next().value as string | undefined;
      if (oldestKey) listResponseCache.delete(oldestKey);
    }
    const totalMs = Math.round(performance.now() - requestStartedAt);
    const serverTiming = [
      ["auth", authMs], ["jobs", timings.jobs], ["subjects", timings.subjects],
      ["variants", timings.variants], ["assets", timings.assets], ["signing", timings.signing], ["total", totalMs],
    ].filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .map(([name, duration]) => `${name};dur=${duration}`).join(", ");
    return Response.json(result, { headers: { "cache-control": "private, no-store", "server-timing": serverTiming } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("GENERATION_LIST_LOAD_FAILED", "We could not load the icon list.", 500);
  }
}
