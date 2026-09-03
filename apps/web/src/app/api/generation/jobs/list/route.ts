import { ICON_STYLE_PRESET_IDS, type IconStylePresetId } from "@icongen/shared";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readGenerationJobs, type GenerationJobStatusFilter } from "@/features/generation/server/generation-job-list-reader";

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
    const user = await requireActiveUser();
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
    const result = await readGenerationJobs(await createServerSupabaseClient(), user.id, {
      page: parsed.data.page,
      usageFilter: parsed.data.usage,
      stylePreset: effectiveStyle,
      structureFilter: parsed.data.usage === "interaction" ? parsed.data.structure : undefined,
      statusFilter: parsed.data.status as GenerationJobStatusFilter | undefined,
    });
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("GENERATION_LIST_LOAD_FAILED", "We could not load the icon list.", 500);
  }
}
