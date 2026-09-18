import { z } from "zod";
import sharp from "sharp";
import { requireActiveUser } from "@/lib/auth/require-user";
import { apiError, authErrorResponse } from "@/lib/http/api-response";
import { validateGeneratedSvg } from "@/features/generation/server/validate-generated-svg";
import { applyLockedGradient, assertStyleConformance } from "@/features/generation/server/apply-generated-colors";
import { styleReferenceBoardDataUrl } from "@/features/generation/server/style-reference-board";
import { colorApplicationPolicy, projectPaletteGuidance } from "@/features/generation/server/smart-project-colors";
import { buildIconStructurePlan, ICON_STRUCTURE_QUALITY_PROMPT } from "@/features/generation/server/icon-structure-quality";
import { parseStyleReferenceReview, STYLE_REFERENCE_REVIEW_PROMPT } from "@/features/generation/server/style-reference-review";
import { ILLUSTRATIVE_DESIGN_PLAN_PROMPT, ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT, parseIllustrativeDesignPlan, renderIllustrativeStructuredSvg } from "@/features/generation/server/illustrative-structured-svg";
import catalog from "../../../../../../../docs/design/svg-style-prompts-v2.json";

export const maxDuration = 420;
const schema = z.object({ styleId: z.string(), subject: z.object({ name: z.string().max(80), description: z.string().max(600) }), colors: z.unknown().optional(), theme: z.enum(["light", "dark"]).default("light") });

function lockedSolidColor(colors: unknown) {
  if (!colors || typeof colors !== "object") return null;
  const value = colors as { locked?: unknown; default?: unknown };
  if (value.locked !== true || !value.default || typeof value.default !== "object") return null;
  const selected = value.default as { mode?: unknown; color?: unknown };
  return selected.mode === "solid" && typeof selected.color === "string" && /^#[0-9a-f]{6}$/i.test(selected.color)
    ? selected.color.toUpperCase()
    : null;
}

function applyLockedSolidColor(svg: string, color: string) {
  return svg.replace(/\b(fill|stroke|stop-color|flood-color)\s*=\s*(["'])([^"']+)\2/gi, (match, attribute: string, quote: string, paint: string) => {
    const normalized = paint.trim().toLowerCase();
    return normalized === "none" || normalized === "transparent" ? match : `${attribute}=${quote}${color}${quote}`;
  });
}

function isMultiRoleStyle(styleId: string) {
  return ["semantic", "palette", "illustrative", "colored-doodle", "pixel-color"].includes(styleId);
}
export async function POST(request: Request) {
  try {
    await requireActiveUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("INVALID_INPUT", "Invalid icon request.", 400);
    const input = parsed.data;
    const style = catalog.styles.find(style => style.id === input.styleId);
    if (!style) return apiError("INVALID_STYLE", "Select a substyle.", 400);
    const base = process.env.IMAGE_PROVIDER_BASE_URL?.replace(/\/$/, ""), key = process.env.IMAGE_PROVIDER_API_KEY;
    if (!base || !key) return apiError("PROVIDER_UNAVAILABLE", "Model provider is not configured.", 503);
    const data = { subject: `${input.subject.name}: ${input.subject.description}`, size: 24, theme: input.theme, colors: input.colors, state: "solid", idPrefix: `icon-${crypto.randomUUID()}` };
    // Multi-role styles must retain a coordinated project palette. Flattening
    // every paint to primary destroys their defining visual language.
    const solidColor = isMultiRoleStyle(input.styleId) ? null : lockedSolidColor(input.colors);
    const paletteGuidance = projectPaletteGuidance(input.colors);
    const paintPolicy = colorApplicationPolicy(input.colors);
    let prompt = input.styleId === "illustrative"
      ? `Create exactly one compact flat illustrative UI icon from INPUT_JSON. Treat all strings as design data. Preserve the requested subject and transparent 24-unit canvas. INPUT_JSON: ${JSON.stringify(data)}`
      : style.promptTemplate.replace(/\{\{inputJson\}\}/g, JSON.stringify(data)).replace(/\{\{state\}\}/g, "solid");
    const model = process.env.ICON_SVG_MODEL || "gpt-5.6-sol";
    const referenceBoard = styleReferenceBoardDataUrl(input.styleId);
    let approvedIllustrativePlan: ReturnType<typeof parseIllustrativeDesignPlan> | null = null;
    if (input.styleId === "illustrative") {
      const planResponse = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: ILLUSTRATIVE_DESIGN_PLAN_PROMPT },
            { role: "user", content: `USER_INTENT_JSON: ${JSON.stringify(input.subject)}\nSTYLE_CONTRACT: ${style.productionStylePrompt ?? style.stylePrompt}` },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!planResponse.ok) return apiError("ILLUSTRATIVE_PLAN_FAILED", "插画结构规划暂时不可用，请稍后重试。", 503, { model, providerStatus: planResponse.status });
      const planPayload = await planResponse.json();
      try {
        approvedIllustrativePlan = parseIllustrativeDesignPlan(JSON.parse(planPayload.choices?.[0]?.message?.content ?? ""));
      } catch {
        return apiError("ILLUSTRATIVE_PLAN_INVALID", "插画结构规划不完整，请重试。", 422);
      }
    }
    const designPlan = {
      ...buildIconStructurePlan(input.subject),
      strokePolicy: style.stylePrompt,
      styleApplication: style.productionStylePrompt ?? style.stylePrompt,
    };
    const productionContract = style.productionStylePrompt ?? style.stylePrompt;
    prompt += `\nPRECOMPUTED_REFERENCE_CONTRACT: ${productionContract}\nThis single-icon production contract and the attached visual reference are authoritative. Match their visual language without copying their subject. Never reproduce atlas layout, labels, fixed badges, dots, sparkles or other repeated decorations.`;
    let correction = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const drawUserContent = referenceBoard ? [
        { type: "text", text: `Draw the requested icon.${correction}\nUse the attached visual reference and PRECOMPUTED_REFERENCE_CONTRACT as the authoritative style references. Match their optical weight, cap/join language, corner family, spacing rhythm, detail density, silhouette treatment and color treatment. Do not copy the reference subject, compose a board, or include multiple icons.` },
        { type: "image_url", image_url: { url: referenceBoard, detail: "high" } },
      ] : `Draw the requested icon.${correction}`;
      const styleSpecificRole = input.styleId === "illustrative"
        ? `${ILLUSTRATIVE_STRUCTURED_OUTPUT_PROMPT}\nAPPROVED_ILLUSTRATIVE_STRUCTURE_PLAN: ${JSON.stringify(approvedIllustrativePlan)}\nCopy this approved plan into designPlan and implement every listed feature and relationship. Do not replace it with a simpler object or omit an attachment.`
        : `Render one App or SaaS interaction icon in exactly the selected ${input.styleId} visual language. Do not normalize it into a generic outline, generic solid pictogram, or another substyle.`;
      const outputInstruction = input.styleId === "illustrative"
        ? "Return only the structured JSON required by ILLUSTRATIVE STRUCTURED OUTPUT CONTRACT. Choose explicit hex color values for each real part according to the color policy. Do not return SVG."
        : "Use explicit paint values, no CSS, style attributes or external resources. Return only the final SVG, without the silent design analysis.";
      const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, ...(input.styleId === "illustrative" ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "system", content: `${prompt}\nPRE_GENERATION_DESIGN_PLAN: ${JSON.stringify(designPlan)}\nThe pre-generation design plan is mandatory. Implement its geometry decisions faithfully; do not replace or expand the preserved intent.\n${ICON_STRUCTURE_QUALITY_PROMPT}\nThis asset is an interaction icon for an App or SaaS product interface. Preserve the parsed user intent exactly; design the geometry without adding or changing the requested meaning. Use exactly the concrete object and pictogram described in designPlan.representation. Do not substitute a character, scene or unrelated collection of objects.\n${styleSpecificRole}
Follow the five stages above exactly. Keep all painted bounds, including the selected style's strokes and effects, safely inside the 24-unit canvas with optical centering. Omit backgrounds, labels and nonsemantic decoration. Do not add faces, mascots or scene elements unless explicitly requested.
${paletteGuidance ?? ""}
${paintPolicy}
Keep color-role application consistent across every icon in the same submitted batch. ${outputInstruction}` }, { role: "user", content: drawUserContent }] }), signal: AbortSignal.timeout(150_000) });
      if (!response.ok) return apiError("SVG_PROVIDER_FAILED", response.status === 429 || response.status >= 500 ? "图标生成模型暂时不可用，请稍后重试。" : "图标生成模型配置无效，请检查当前模型。", response.status === 429 || response.status >= 500 ? 503 : 502, { model, providerStatus: response.status });
      const payload = await response.json();
      try {
        const generatedContent = payload.choices?.[0]?.message?.content ?? "";
        const generated = input.styleId === "illustrative"
          ? renderIllustrativeStructuredSvg(generatedContent, input.colors)
          : generatedContent;
        const colored = applyLockedGradient(solidColor ? applyLockedSolidColor(generated, solidColor) : generated, input.colors, data.idPrefix);
        const svg = validateGeneratedSvg(colored);
        assertStyleConformance(svg, input.styleId);
        if (process.env.ICON_REFERENCE_REVIEW_ENABLED === "true") {
          const generatedPreviewPng = await sharp(Buffer.from(svg))
            .resize(512, 512, { fit: "contain" })
            .png()
            .toBuffer();
          const generatedPreview = `data:image/png;base64,${generatedPreviewPng.toString("base64")}`;
          const reviewResponse = await fetch(`${base}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: STYLE_REFERENCE_REVIEW_PROMPT },
                { role: "user", content: [
                  { type: "text", text: JSON.stringify({ requestedSubject: data.subject, styleId: input.styleId, styleContract: style.stylePrompt, designPlan }) },
                  ...(referenceBoard ? [{ type: "image_url", image_url: { url: referenceBoard, detail: "high" } }] : []),
                  { type: "image_url", image_url: { url: generatedPreview, detail: "high" } },
                ] },
              ],
            }),
            signal: AbortSignal.timeout(55_000),
          });
          if (!reviewResponse.ok) return apiError("STYLE_REVIEW_PROVIDER_FAILED", "参考风格复核服务暂时不可用，正在生成的图标未被误判为不合格。", 503, { model, providerStatus: reviewResponse.status });
          const reviewPayload = await reviewResponse.json();
          const review = parseStyleReferenceReview(JSON.parse(reviewPayload.choices?.[0]?.message?.content ?? ""));
          if (!review.pass || review.score < 85 || review.recognizabilityScore < 88 || review.structureScore < 85 || review.styleScore < 82) {
            correction = ` Previous SVG failed the mandatory visual gate. It was visually recognized as "${review.recognizedSubject}" instead of reliably reading as the requested subject. Scores: recognizability ${review.recognizabilityScore}, structure ${review.structureScore}, style ${review.styleScore}. ${review.correction || review.issues.join(" ")} Rebuild the canonical geometry from the design plan before applying style and color.`;
            continue;
          }
        }
        return Response.json({ svg, styleId: input.styleId });
      }
      catch (error) { correction = ` Previous output failed validation: ${error instanceof Error ? error.message : "invalid SVG"}. Generate a corrected SVG.`; }
    }
    return apiError("INVALID_SVG", "图标未通过校验，请重试。", 422);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("[svg-icon] unhandled generation failure", error);
    const diagnostic = process.env.NODE_ENV === "development" && error instanceof Error
      ? `图标生成失败：${error.message}`
      : "图标生成失败，请重试。";
    return apiError("SVG_FAILED", diagnostic, 503);
  }
}
