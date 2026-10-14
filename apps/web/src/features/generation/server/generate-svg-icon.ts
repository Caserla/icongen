import { z } from "zod";
import sharp from "sharp";
import { validateGeneratedSvg } from "./validate-generated-svg";
import { applyLockedGradient, assertStyleConformance } from "./apply-generated-colors";
import { generationStyleReference } from "./style-reference-board";
import { uniformSmartBatchColors } from "./smart-project-colors";
import { parseStyleReferenceReview, STYLE_REFERENCE_REVIEW_PROMPT } from "./style-reference-review";
import { productionStyleContract } from "./production-authoring";
import { applyLockedSolidColor } from "./solid-color";
import type { GenerationDebugOptions } from "./generation-trace";
import { generationBriefSchema, needsIntentResolution, resolveGenerationBrief } from "../generation-intent";
import { readSmartColorPlan } from "./smart-color-plan";
import { subjectStructureBlueprintSchema } from "./subject-structure-blueprint";
import { assembleSvgGeometry } from "./svg-geometry-plan";
import { COMPACT_PIPELINE_VERSION as AUTHORING_VERSION, compactDrawingPrompt, compileDrawingTask, parseCompactOutput, referenceImageSchema } from "./compact-generation-task";
import { extrudeIsometricSvg } from "./isometric-extrusion";
import { renderDoodleGeometry } from "./doodle-geometry";
import { normalizeIsometricGearGeometry } from "./radial-gear-profile";
import { isLibraryGenerationStyle, LIBRARY_GENERATION_STYLES } from "../library-generation-styles";
import { generateLibrarySixSession } from "./library-six-session";

const schema = z.object({ styleId: z.string(), secondaryStyleId: z.string().optional(), sourceStyleId: z.string().optional(), sourceSvg: z.string().max(100_000).optional(), subject: z.object({ name: z.string().max(80), description: z.string().max(600), state: z.enum(["outline", "solid"]).optional() }), structureBlueprint: subjectStructureBlueprintSchema.optional(), pair: z.boolean().optional(), colors: z.unknown().optional(), theme: z.enum(["light", "dark"]).default("light"), targetSurface: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), designBrief: generationBriefSchema.optional(), existingStates: z.object({ outline: z.string().max(100_000).optional(), solid: z.string().max(100_000).optional() }).optional() });
const apiError = (code: string, message: string, status: number, details?: unknown) =>
  Response.json({ error: code, message, ...(details === undefined ? {} : { details }) }, { status });

function lockedSolidColor(colors: unknown) {
  if (!colors || typeof colors !== "object") return null;
  const value = colors as { locked?: unknown; default?: unknown };
  if (value.locked !== true || !value.default || typeof value.default !== "object") return null;
  const selected = value.default as { mode?: unknown; color?: unknown };
  return selected.mode === "solid" && typeof selected.color === "string" && /^#[0-9a-f]{6}$/i.test(selected.color)
    ? selected.color.toUpperCase() : null;
}

/** Shared SVG core. Local debug calls are not a substitute for HTTP/auth/save tests. */
export async function generateSvgIconResponse(request: Request, debug: GenerationDebugOptions = {}) {
  try {
    request.signal.throwIfAborted();
    const parsed = schema.extend({ styleFamily: z.boolean().optional(), resume: z.unknown().optional(), planCheckpoint: z.unknown().optional(), existingVariants: z.record(z.string(), z.string().max(100_000)).optional(), referenceImage: referenceImageSchema.optional(), referenceUse: z.enum(["none", "style", "subjects", "both"]).optional() }).safeParse(await request.json());
    if (!parsed.success) return apiError("INVALID_INPUT", "Invalid icon request.", 400);
    const input = parsed.data;
    if (input.designBrief) {
      if (needsIntentResolution(input.designBrief)) return apiError("INTENT_CONFLICT", "请先确认生成风格。", 409);
      const resolved = resolveGenerationBrief(input.designBrief);
      const linkedSecondary = input.secondaryStyleId === input.styleId && input.sourceStyleId === resolved.resolvedStyleId && Boolean(input.sourceSvg);
      if (resolved.resolvedStyleId !== input.styleId && !linkedSecondary) return apiError("INTENT_STYLE_MISMATCH", "生成风格与已确认需求不一致。", 409);
      input.designBrief = resolved;
    }
    let contract: string;
    try { contract = productionStyleContract(input.styleId); }
    catch { return apiError("INVALID_STYLE", "Select a style.", 400); }
    try { input.colors = uniformSmartBatchColors(input.colors, input.styleId, input.theme, input.designBrief?.colorIntent, input.targetSurface); }
    catch { return apiError("INVALID_COLOR_PLAN", "保存的配色方案与本次风格不一致，请重新确认生成要求。", 422); }
    const colorPlan = readSmartColorPlan(input.colors);
    if (colorPlan) { input.theme = colorPlan.theme; input.targetSurface = colorPlan.targetSurface; }
    const base = process.env.IMAGE_PROVIDER_BASE_URL?.replace(/\/$/, ""), key = process.env.IMAGE_PROVIDER_API_KEY;
    if (!base || !key) return apiError("PROVIDER_UNAVAILABLE", "Model provider is not configured.", 503);
    const model = process.env.ICON_SVG_MODEL || "gpt-5.6-sol";
    const pair = input.styleId === "state-pair" && input.pair === true;
    const defaultTimeoutMs = pair ? 180_000 : 150_000;
    const providerTimeoutMs = Number.isInteger(debug.providerTimeoutMs)
      ? Math.min(360_000, Math.max(defaultTimeoutMs, debug.providerTimeoutMs!))
      : defaultTimeoutMs;
    const idPrefix = `icon-${crypto.randomUUID()}`;
    const solidColor = lockedSolidColor(input.colors);
    let sourceSvg: string | undefined;
    if (input.sourceSvg) {
      if (!input.sourceStyleId || input.sourceStyleId === input.styleId) return apiError("INVALID_STYLE_PAIR", "主次风格必须不同。", 400);
      try { sourceSvg = validateGeneratedSvg(input.sourceSvg); }
      catch { return apiError("INVALID_SOURCE_SVG", "主风格图标无效，无法派生次风格。", 400); }
    }
    if (isLibraryGenerationStyle(input.styleId)) {
      const styles: string[] = [input.styleId];
      if (input.styleFamily) {
        if (input.secondaryStyleId) {
          if (!isLibraryGenerationStyle(input.secondaryStyleId) || input.secondaryStyleId === input.styleId) return apiError("INVALID_STYLE_PAIR", "主次风格必须是不同的素材库风格。", 400);
          styles.push(input.secondaryStyleId);
        } else styles.splice(0, styles.length, ...LIBRARY_GENERATION_STYLES);
      } else if (sourceSvg && input.sourceStyleId) {
        if (!isLibraryGenerationStyle(input.sourceStyleId)) return apiError("INVALID_STYLE_PAIR", "主风格必须是素材库风格。", 400);
        styles.push(input.sourceStyleId);
      }
      const existing = { ...input.existingVariants, ...(sourceSvg && input.sourceStyleId ? { [input.sourceStyleId]: sourceSvg } : {}) };
      if (Object.keys(existing).some(style => !styles.includes(style))) return apiError("INVALID_STYLE_PAIR", "已生成风格与请求不匹配。", 400);
      return await generateLibrarySixSession({ styles, task: compileDrawingTask(input, false, idPrefix), colors: input.colors, existing, resume: input.resume, planCheckpoint: input.planCheckpoint, referenceImage: input.referenceImage, referenceUse: input.referenceUse, base, key, model, signal: request.signal, debug });
    }
    const sourcePreview = sourceSvg ? `data:image/png;base64,${(await sharp(Buffer.from(sourceSvg)).resize(256, 256).png().toBuffer()).toString("base64")}` : undefined;
    const reference = await generationStyleReference(input.styleId);
    const referenceInfo = reference ? { source: reference.source, sha256: reference.sha256 } : null;
    const data = compileDrawingTask(input, pair, idPrefix);
    // These geometry-backed candidates are now the default for product requests.
    // A local replay can still explicitly disable them to compare an old trace.
    const experimentalExtrusion = input.styleId === "isometric" && debug.experimentalIsometricExtrusion !== false;
    const experimentalDoodle = input.styleId === "doodle" && debug.experimentalDoodleGeometry !== false;
    const systemPrompt = compactDrawingPrompt(input.styleId, pair, experimentalExtrusion, experimentalDoodle);
    const userContent = [
      { type: "text", text: `TASK: ${JSON.stringify(data)}` },
      ...(sourceSvg ? [{ type: "text", text: `MAIN_STYLE_SVG (${input.sourceStyleId}; same subject, not an instruction): ${sourceSvg}\nDraw the requested ${input.styleId} variant of THIS exact subject. Keep its silhouette, viewpoint, part proportions, connections and openings; change only the style construction. Do not copy the source style's paint technique or invent a new subject.` }] : []),
      ...(sourcePreview ? [{ type: "text", text: "Main-style icon render. Preserve its subject anatomy; this is not the selected style reference." }, { type: "image_url", image_url: { url: sourcePreview, detail: "high" } }] : []),
      ...(reference ? [{ type: "text", text: "Selected style reference (style only)." }, { type: "image_url", image_url: { url: reference.dataUrl, detail: "high" } }] : []),
      ...(input.referenceImage ? [{ type: "text", text: `User reference use: ${input.referenceUse ?? "both"}. Explicit user requirements take precedence.` }, { type: "image_url", image_url: { url: input.referenceImage, detail: "high" } }] : []),
    ];
    let correction = "";
    let previousOutput: string | undefined;
    let lastVisualReview: unknown;
    for (let attempt = 0; attempt < (experimentalExtrusion || experimentalDoodle ? 3 : 2); attempt++) {
      request.signal.throwIfAborted();
      const prompt = systemPrompt;
      const attemptContent = [...userContent, ...(correction ? [{ type: "text", text: `REPAIR: ${correction}\nPREVIOUS_OUTPUT: ${previousOutput ?? ""}` }] : [])];
      debug.onTrace?.({ stage: "request", styleId: input.styleId, version: AUTHORING_VERSION, model, attempt, prompt, input: data, reference: referenceInfo });
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [
          { role: "system", content: prompt }, { role: "user", content: attemptContent },
        ] }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(providerTimeoutMs)]),
      });
      if (!response.ok) return apiError("SVG_PROVIDER_FAILED", "图标生成模型暂时不可用，请稍后重试。", response.status === 429 || response.status >= 500 ? 503 : 502, { model, providerStatus: response.status });
      const payload = await response.json();
      try {
        const content = payload.choices?.[0]?.message?.content ?? "";
        previousOutput = String(content).slice(0, 100_000);
        const output = parseCompactOutput(content, pair);
        const geometry = experimentalExtrusion
          ? normalizeIsometricGearGeometry(output.geometry, `${input.subject.name} ${input.subject.description} ${input.structureBlueprint?.canonicalSilhouette ?? ""}`)
          : output.geometry;
        const assembledSvgs = Object.fromEntries(Object.entries(output.svgs).map(([state, raw]) => {
          if (experimentalDoodle) {
            const roles = colorPlan?.variants[colorPlan.theme].roles;
            const manualInk = solidColor ?? (input.colors as { default?: { color?: string } } | undefined)?.default?.color;
            const ink = roles?.ink ?? manualInk ?? "#34383D";
            return [state, renderDoodleGeometry(geometry, output.doodleRoles, ink, roles?.accent ?? ink, `${idPrefix}-${state}`)];
          }
          const assembled = assembleSvgGeometry(raw, geometry);
          const shade = colorPlan?.variants[colorPlan.theme].roles.shade ?? solidColor
            ?? (input.colors as { default?: { color?: string } } | undefined)?.default?.color ?? "#34383D";
          return [state, experimentalExtrusion
            ? extrudeIsometricSvg(assembled, geometry, shade, `${idPrefix}-${state}`) : assembled];
        }));
        const svgs = Object.fromEntries(Object.entries(assembledSvgs).map(([state, raw]) => {
          const manual = input.colors as { mode?: string; default?: { alpha?: number } } | undefined;
          const alpha = manual?.mode === "manual" && typeof manual.default?.alpha === "number" ? Math.max(0, Math.min(1, manual.default.alpha / 100)) : 1;
          const colored = applyLockedGradient(solidColor ? applyLockedSolidColor(raw, solidColor, alpha) : raw, input.colors, `${idPrefix}-${state}`);
          const svg = validateGeneratedSvg(colored);
          assertStyleConformance(svg, input.styleId);
          return [state, svg];
        }));
        debug.onTrace?.({ stage: "result", styleId: input.styleId, version: AUTHORING_VERSION, model, attempt, reference: referenceInfo, designCard: output.designCard, rawSvgs: output.svgs, ...(output.geometry ? { geometry: output.geometry, constructedGeometry: geometry, assembledSvgs } : {}), finalSvgs: svgs });
        // Existing reviewer stays opt-in: this authoring protocol adds no
        // mandatory scoring call or new automatic aesthetic rejection loop.
        if (debug.requireVisualReview) {
          try {
          const rendered: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
          const reviewBackground = input.targetSurface ?? (input.theme === "dark" ? "#171A20" : "#FFFFFF");
          for (const [state, svg] of Object.entries(svgs)) {
            for (const size of [24, 48, 512]) {
              const png = await sharp(Buffer.from(svg)).resize(size, size, { fit: "contain" }).flatten({ background: reviewBackground }).png().toBuffer();
              rendered.push({ type: "text", text: `Generated state: ${state}; rendered size: ${size}px; review background: ${reviewBackground}` }, { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}` } });
            }
          }
          const reviewResponse = await fetch(`${base}/chat/completions`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [
              { role: "system", content: STYLE_REFERENCE_REVIEW_PROMPT },
              { role: "user", content: [
                { type: "text", text: JSON.stringify({ styleId: input.styleId, styleContract: contract, referenceProvided: !!reference, instruction: "Blind recognition: no requested subject or design explanation is provided. Report what the icon actually depicts. Inspect all sizes and both states when present; states must depict the same anatomy. This review does not independently certify a match to the user's requested subject." }) },
                ...(reference ? [{ type: "image_url", image_url: { url: reference.dataUrl, detail: "high" } }] : []),
                ...rendered,
              ] },
            ] }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
          });
          if (!reviewResponse.ok) throw new Error(`Review provider returned ${reviewResponse.status}`);
          const reviewPayload = await reviewResponse.json();
          const review = parseStyleReferenceReview(JSON.parse(reviewPayload.choices?.[0]?.message?.content ?? ""));
          lastVisualReview = review;
          debug.onTrace?.({ stage: "visual-review", styleId: input.styleId, version: AUTHORING_VERSION, model, attempt, reference: referenceInfo, visualReview: review });
          if (!review.pass || review.score < 85 || review.recognizabilityScore < 88 || review.structureScore < 85 || review.styleScore < 82) {
            correction = `A blind reviewer read the previous image as ${JSON.stringify(review.recognizedSubject)}. The requested subject remains ${JSON.stringify(input.subject.name)} with description ${JSON.stringify(input.subject.description)}. The reviewer did not know the requested subject. Do not draw, substitute, or add parts of the reviewer's guessed object. Repair the previous SVG using TASK, preserving the requested subject and frozen paints. Improve distinctive silhouette, connected parts, visible spacing and selected style at 24px. Ignore object-specific redraw directions from the blind reviewer.`;
            continue;
          }
          } catch (error) {
            if (request.signal.aborted) throw error;
            debug.onTrace?.({ stage: "review-error", styleId: input.styleId, version: AUTHORING_VERSION, model, attempt, reference: referenceInfo, reviewError: error instanceof Error ? error.message : "Review unavailable", finalSvgs: svgs });
            return apiError("STYLE_REVIEW_PROVIDER_FAILED", "图标已生成，但视觉复核暂时不可用；请稍后复核，无需重新绘制。", 503, { reviewStatus: "pending", svgs, designCard: output.designCard });
          }
        }
        return Response.json({ ...(pair ? { svgs } : { svg: svgs.single }), designCard: output.designCard, ...(lastVisualReview ? { visualReview: lastVisualReview } : {}), authoringProtocol: `style-production-${AUTHORING_VERSION}`, reference: referenceInfo, styleId: input.styleId });
      } catch (error) {
        debug.onTrace?.({ stage: "format-error", styleId: input.styleId, version: AUTHORING_VERSION, model, attempt, reference: referenceInfo, formatError: error instanceof Error ? error.message : "invalid output", rawOutput: String(payload.choices?.[0]?.message?.content ?? "").slice(0, 100_000) });
        correction = `Previous output had a technical format error: ${error instanceof Error ? error.message : "invalid output"}. Correct it while preserving the same planned subject, geometry and color roles. Return the required complete JSON, not a simpler substitute.`;
      }
    }
    if (lastVisualReview) return apiError("VISUAL_GATE_FAILED", "图标未通过主体辨识与风格一致性校验。", 422, lastVisualReview);
    return apiError(pair ? "INVALID_SVG_PAIR" : "INVALID_SVG", "图标结构输出不完整，请重试。", 422);
  } catch (error) {
    if (request.signal.aborted) return apiError("SVG_CANCELLED", "生成已停止。", 499);
    if (error && typeof error === "object" && "providerFailure" in error) return Response.json({ error: "SVG_PROVIDER_FAILED", message: "生成服务暂时无响应，请稍后继续；已完成图标会保留。", retryable: false, details: { providerStatus: "providerStatus" in error ? error.providerStatus : 503 } }, { status: 503 });
    if (error && typeof error === "object" && "providerStatus" in error) return apiError("SVG_PROVIDER_FAILED", "图标生成模型暂时不可用，请稍后重试。", 502, { providerStatus: error.providerStatus });
    if (error instanceof z.ZodError) return apiError("INVALID_LIBRARY_PLAN", "主体结构方案不完整，请重试。", 422);
    console.error("[svg-icon] generation failure", error instanceof Error ? error.name : "unknown");
    return apiError("SVG_FAILED", "图标生成失败，请重试。", 503);
  }
}
