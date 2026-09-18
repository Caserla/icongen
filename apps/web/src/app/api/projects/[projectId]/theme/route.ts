import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/).transform((v) => v.toUpperCase());
const themeSchema = z.object({ primary: hex, secondary: hex, tertiary: hex, neutral: hex });
const themeUpdateSchema = z.object({ theme: themeSchema, source: z.enum(["ai", "manual", "preset"]) });
const modelSchema = z.object({ recognizable: z.boolean(), confidence: z.number().min(0).max(1), reason: z.string(), theme: themeSchema.nullable() });

export async function POST(_request: Request, context: RouteContext<"/api/projects/[projectId]/theme">) {
  try {
    const user = await requireActiveUser();
    const { projectId } = await context.params;
    const client = await createServerSupabaseClient();
    const result = await client.from("icon_projects").select("id,name,description").eq("id", projectId).eq("user_id", user.id).single();
    if (result.error || !result.data) return apiError("PROJECT_NOT_FOUND", "Project not found.", 404);
    const baseURL = process.env.IMAGE_PROVIDER_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.IMAGE_PROVIDER_API_KEY;
    if (!baseURL || !apiKey) throw new Error("Theme provider is not configured");
    await client.from("icon_projects").update({ theme_status: "pending", theme_failure_reason: null }).eq("id", projectId).eq("user_id", user.id);
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.6-terra",
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a product brand color director. First decide whether the project name and description communicate a recognizable product. Return JSON only: recognizable, confidence, reason, theme. theme is null when unrecognizable; otherwise theme contains primary, secondary, tertiary, neutral as #RRGGBB. Produce usable UI colors reflecting the product character. The neutral color must be low saturation. Keep the four colors visually distinct." },
          { role: "user", content: `Project name: ${result.data.name}\nProject description: ${result.data.description}` },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Theme provider returned ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = modelSchema.parse(JSON.parse(payload.choices?.[0]?.message?.content ?? ""));
    if (!parsed.recognizable || parsed.confidence < 0.6 || !parsed.theme) {
      await client.from("icon_projects").update({ theme_status: "failed", theme_source: "preset", theme_failure_reason: parsed.reason }).eq("id", projectId).eq("user_id", user.id);
      return apiError("THEME_UNRECOGNIZABLE", "Project created, but its theme could not be generated.", 422);
    }
    const update = { theme: parsed.theme, ai_theme: parsed.theme, theme_status: "ready", theme_source: "ai", theme_failure_reason: null, theme_generated_at: new Date().toISOString() };
    const saved = await client.from("icon_projects").update(update).eq("id", projectId).eq("user_id", user.id).select("id,name,description,theme,ai_theme,custom_theme,theme_status,theme_source").single();
    if (saved.error) throw saved.error;
    return Response.json({ item: saved.data });
  } catch (error) {
    const auth = authErrorResponse(error); if (auth) return auth;
    return apiError("THEME_GENERATION_FAILED", "Project created, but its theme could not be generated.", 503);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/projects/[projectId]/theme">) {
  const parsed = themeUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_THEME", "Invalid project theme.", 400);
  try {
    const user = await requireActiveUser(); const { projectId } = await context.params; const client = await createServerSupabaseClient();
    const update = { theme: parsed.data.theme, ...(parsed.data.source === "manual" ? { custom_theme: parsed.data.theme } : {}), theme_status: "ready", theme_source: parsed.data.source, theme_failure_reason: null, theme_generated_at: new Date().toISOString() };
    const saved = await client.from("icon_projects").update(update).eq("id", projectId).eq("user_id", user.id).select("id,name,description,theme,ai_theme,custom_theme,theme_status,theme_source").single();
    if (saved.error) throw saved.error;
    return Response.json({ item: saved.data });
  } catch (error) { return authErrorResponse(error) ?? apiError("THEME_SAVE_FAILED", "Theme could not be saved.", 503); }
}
