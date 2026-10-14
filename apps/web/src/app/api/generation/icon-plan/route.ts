import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { ICON_GENERATION_CATEGORIES } from "@/features/generation/icon-generation-categories";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { lockSmartColorsToProject } from "@/features/generation/server/smart-project-colors";
import { IconPlanProviderError, planIcons } from "@/features/generation/server/plan-icons";
import { isLibraryGenerationStyle } from "@/features/generation/library-generation-styles";

export const maxDuration = 90;
const requestSchema = z.object({ prompt: z.string().trim().max(6000), projectId: z.string().uuid(), projectName: z.string().trim().max(200).optional(), projectDescription: z.string().max(6000).optional(), styleId: z.string(), styleFamily: z.boolean().optional(), secondaryStyleId: z.string().refine(isLibraryGenerationStyle, "Unknown secondary style").optional(), locale: z.enum(["zh", "en"]), colors: z.unknown().optional(), theme: z.enum(["light", "dark"]).default("light"), targetSurface: z.string().regex(/^#[0-9a-f]{6}$/i).optional() });
export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    if (Number(request.headers.get("content-length") ?? 0) > 6_000_000) return apiError("TOO_LARGE", "Reference image must be smaller than 5 MB.", 413);
    const form = await request.formData();
    const parsed = requestSchema.safeParse(JSON.parse(String(form.get("input") ?? "{}")));
    if (!parsed.success) return apiError("INVALID_INPUT", "Invalid icon request.", 400);
    const input = parsed.data;
    if (!ICON_GENERATION_CATEGORIES.some(category => category.id === input.styleId)) return apiError("SELECT_STYLE", "Select an icon style first.", 400);
    if (input.styleFamily && !isLibraryGenerationStyle(input.styleId)) return apiError("INVALID_STYLE", "Six-style generation requires a library style.", 400);
    if (input.secondaryStyleId && (!ICON_GENERATION_CATEGORIES.some(category => category.id === input.secondaryStyleId) || input.secondaryStyleId === input.styleId)) return apiError("INVALID_SECONDARY_STYLE", "Choose a different secondary style.", 400);
    if (!input.projectName) return apiError("PROJECT_REQUIRED", "Add or link a project first.", 400);
    const client = await createServerSupabaseClient();
    const { data: project, error: projectError } = await client.from("icon_projects").select("name,description,theme").eq("user_id", user.id).eq("id", input.projectId).maybeSingle();
    if (projectError || !project) return apiError("PROJECT_REQUIRED", "Add or link a project first.", 400);
    const verifiedInput = { ...input, projectName: project.name, projectDescription: project.description ?? "", colors: lockSmartColorsToProject(input.colors, project.theme) };
    const file = form.get("reference");
    if (!input.prompt && !(file instanceof File && file.size)) return apiError("EMPTY_INPUT", "Enter a description or attach an image.", 400);
    let referenceDataUrl: string | undefined;
    if (file instanceof File && file.size) {
      if (file.size > 5_000_000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return apiError("INVALID_IMAGE", "Use a PNG, JPEG or WebP reference up to 5 MB.", 400);
      referenceDataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
    return Response.json(await planIcons(verifiedInput, { referenceDataUrl, signal: request.signal }));
  } catch (error) {
    if (error instanceof IconPlanProviderError) return apiError(error.code, error.message, error.status, error.details);
    return authErrorResponse(error) ?? apiError("PLAN_FAILED", "需求解析失败，请重试，输入内容已保留。", 503);
  }
}
