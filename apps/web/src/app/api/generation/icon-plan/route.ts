import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { ICON_PLAN_PROMPT, normalizeIconPlan } from "@/features/generation/icon-plan";
import { ICON_GENERATION_CATEGORIES } from "@/features/generation/icon-generation-categories";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { lockSmartColorsToProject } from "@/features/generation/server/smart-project-colors";

export const maxDuration = 90;
const requestSchema = z.object({ prompt: z.string().trim().max(6000), projectId: z.string().uuid(), projectName: z.string().trim().max(200).optional(), projectDescription: z.string().max(6000).optional(), styleId: z.string(), locale: z.enum(["zh", "en"]), colors: z.unknown().optional() });
export async function POST(request: Request) {
  try {
    const user = await requireActiveUser();
    if (Number(request.headers.get("content-length") ?? 0) > 6_000_000) return apiError("TOO_LARGE", "Reference image must be smaller than 5 MB.", 413);
    const form = await request.formData();
    const parsed = requestSchema.safeParse(JSON.parse(String(form.get("input") ?? "{}")));
    if (!parsed.success) return apiError("INVALID_INPUT", "Invalid icon request.", 400);
    const input = parsed.data;
    if (!ICON_GENERATION_CATEGORIES.some(category => category.children.some(child => child.id === input.styleId))) return apiError("SELECT_SUBSTYLE", "Select an icon substyle first.", 400);
    if (!input.projectName) return apiError("PROJECT_REQUIRED", "Add or link a project first.", 400);
    const client = await createServerSupabaseClient();
    const { data: project, error: projectError } = await client.from("icon_projects").select("name,description,theme").eq("user_id", user.id).eq("id", input.projectId).maybeSingle();
    if (projectError || !project) return apiError("PROJECT_REQUIRED", "Add or link a project first.", 400);
    const verifiedInput = { ...input, projectName: project.name, projectDescription: project.description ?? "", colors: lockSmartColorsToProject(input.colors, project.theme) };
    const file = form.get("reference");
    if (!input.prompt && !(file instanceof File && file.size)) return apiError("EMPTY_INPUT", "Enter a description or attach an image.", 400);
    const content: Array<Record<string, unknown>> = [{ type: "text", text: JSON.stringify(verifiedInput) }];
    if (file instanceof File && file.size) {
      if (file.size > 5_000_000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return apiError("INVALID_IMAGE", "Use a PNG, JPEG or WebP reference up to 5 MB.", 400);
      content.push({ type: "image_url", image_url: { url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` } });
    }
    const base = process.env.IMAGE_PROVIDER_BASE_URL?.replace(/\/$/, "");
    const key = process.env.IMAGE_PROVIDER_API_KEY;
    if (!base || !key) return apiError("PROVIDER_UNAVAILABLE", "Model provider is not configured.", 503);
    const model = process.env.ICON_PLANNER_MODEL || "gpt-5.6-sol";
    const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: ICON_PLAN_PROMPT }, { role: "user", content }] }), signal: AbortSignal.timeout(75_000) });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      return apiError("PLAN_PROVIDER_FAILED", retryable ? "需求解析模型暂时不可用，请稍后重试。" : "需求解析模型配置无效，请检查当前模型。", retryable ? 503 : 502, { model, providerStatus: response.status });
    }
    const payload = await response.json();
    const plan = normalizeIconPlan(JSON.parse(payload.choices?.[0]?.message?.content ?? ""));
    return Response.json({ plan, snapshot: verifiedInput });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("PLAN_FAILED", "需求解析失败，请重试，输入内容已保留。", 503);
  }
}
