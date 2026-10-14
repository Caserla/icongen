import { createHash } from "node:crypto";
import { z } from "zod";
import { libraryFamilyDrawingPrompt, libraryPlanningPrompt, libraryProtocol, libraryReviewPrompt, libraryReviewSchema, librarySubjectPlanSchema, libraryPlanningOutputSchema, parseLibraryReview, LIBRARY_SESSION_VERSION } from "./library-six-plan";
import { inspectLibrarySvg, renderLibraryReview } from "./library-six-render";
import { generationStyleReference } from "./style-reference-board";
import { applyLockedSolidColor } from "./solid-color";
import { applyLockedGradient } from "./apply-generated-colors";
import { validateGeneratedSvg } from "./validate-generated-svg";
import type { GenerationDebugOptions } from "./generation-trace";
import { libraryConstructionReference } from "./library-construction-reference";
import { compileLibraryOutline, ensureLibraryOutlineKernel } from "./library-outline-geometry";
import { stableGenerationJson } from "../generation-checkpoint";
import { createLibraryPlanCheckpoint, readLibraryPlanCheckpoint } from "./library-plan-checkpoint";

// Decode the envelope once, then validate each style independently. A malformed
// sibling (e.g. null instead of SVG) must not discard the other valid variants.
const drawingSchema = z.object({ variants: z.record(z.string(), z.unknown()) });
// Real successful planning calls took 90–102s. Do not discard them at 70s;
// retain the existing total deadline, leaving room for draw + rendered review.
export const librarySessionBudgets = { total: 360_000, plan: 120_000, draw: 110_000, familyDraw: 170_000, review: 65_000 } as const;
type Content = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } };
const asText = (value: unknown): Content => ({ type: "text", text: JSON.stringify(value) });
const digest = (svg: string) => createHash("sha256").update(svg).digest("hex");
const json = (value: unknown) => JSON.parse(String(value).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
const resumeSchema = z.object({ variants: z.record(z.string(), z.string().max(100_000)), context: z.object({
  protocolHash: z.string(), subjectKey: z.string(), plan: librarySubjectPlanSchema, finalHashes: z.record(z.string(), z.string()),
  version: z.string().optional(), repairCount: z.number().int().min(0).max(1000).optional(),
  measurements: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  outlineSource: z.string().max(100_000).optional(), outlineSourceHash: z.string().optional(),
  calls: z.array(z.object({ stage: z.string(), model: z.string(), elapsedMs: z.number(), promptHash: z.string().optional(), inputHash: z.string().optional(), outcome: z.enum(["success", "provider-error"]).optional() })).max(100).optional(),
}) });

export async function generateLibrarySixSession(options: {
  styles: string[]; task: unknown; colors: unknown; existing?: Record<string, string>;
  referenceImage?: string; referenceUse?: string;
  resume?: unknown; planCheckpoint?: unknown;
  base: string; key: string; model: string; signal: AbortSignal; debug: GenerationDebugOptions;
}) {
  const { styles, colors, base, key, model, signal, debug } = options;
  // The old single/state-pair envelope must not contradict the family output contract.
  const task = { ...Object.fromEntries(Object.entries(options.task as Record<string, unknown>).filter(([key]) => !["styleId", "states", "existingStates", "version"].includes(key))), requestedStyles: styles, version: LIBRARY_SESSION_VERSION };
  const subjectKey = digest(JSON.stringify((options.task as { subject: unknown }).subject));
  const resume = options.resume ? resumeSchema.parse(options.resume) : undefined;
  if (resume && (resume.context.protocolHash !== libraryProtocol.sha256 || resume.context.subjectKey !== subjectKey
    || (resume.context.outlineSource && digest(resume.context.outlineSource) !== resume.context.outlineSourceHash)
    || (resume.context.outlineSource && (resume.context.measurements?.outline?.compilation as { sourceHash?: string } | undefined)?.sourceHash !== resume.context.outlineSourceHash)
    || Object.keys(resume.variants).length !== styles.length || styles.some(style => !resume.variants[style] || digest(resume.variants[style]) !== resume.context.finalHashes[style]))) {
    return Response.json({ error: "INVALID_RESUME", message: "复核上下文与当前图标不一致，不能沿用旧的复核记录。" }, { status: 409 });
  }
  const started = Date.now();
  const sessionSignal = AbortSignal.any([signal, AbortSignal.timeout(librarySessionBudgets.total)]);
  const calls: Array<{ stage: string; model: string; elapsedMs: number; promptHash: string; inputHash: string; outcome: "success" | "provider-error" }> = [];
  const references = await Promise.all(styles.map(generationStyleReference));
  const reference = references[0] ? { source: references[0].source, sha256: references[0].sha256 } : null;
  const referenceContent: Content[] = references.flatMap((ref, index) => ref ? [asText({ referenceStyle: styles[index], use: "style construction only; do not copy target subject" }), { type: "image_url" as const, image_url: { url: ref.dataUrl, detail: "high" as const } }] : []);
  if (options.referenceImage) referenceContent.push(asText({ userReferenceUse: options.referenceUse ?? "both" }), { type: "image_url", image_url: { url: options.referenceImage, detail: "high" } });
  const existing = Object.fromEntries(Object.entries(options.existing ?? {}).map(([style, svg]) => [style, validateGeneratedSvg(svg)]));
  // Bind all design inputs, references and current prompt revisions; only the
  // per-request SVG ID namespace may differ across retries. No credentials leave the server.
  const checkpointInputHash = digest(stableGenerationJson({
    task: Object.fromEntries(Object.entries(task).filter(([name]) => name !== "idPrefix")), colors, existing,
    protocol: libraryProtocol.sha256, version: LIBRARY_SESSION_VERSION,
    planningPrompt: digest(libraryPlanningPrompt(styles)), drawingPrompt: digest(libraryFamilyDrawingPrompt(styles)),
    references: references.map(ref => ref?.sha256 ?? null),
    userReference: options.referenceImage ? digest(options.referenceImage) : null, referenceUse: options.referenceUse,
  }));
  const checkpoint = options.planCheckpoint ? readLibraryPlanCheckpoint(options.planCheckpoint, checkpointInputHash, key) : undefined;
  if (options.planCheckpoint && (!checkpoint || resume)) return Response.json({
    error: "INVALID_PLAN_CHECKPOINT", message: "保存的规划已过期或与当前设置不一致，已清除；请重新生成。", retryable: false,
  }, { status: 409 });
  const missing = styles.filter(style => !existing[style]);
  if (!missing.length) throw new Error("No missing library variant");
  // Infrastructure is not bad geometry. Fail before paid calls, never ask the
  // model to repair an unavailable local compiler.
  if (missing.includes("outline")) {
    try { await ensureLibraryOutlineKernel(); }
    catch {
      return Response.json({ error: "SVG_RUNTIME_UNAVAILABLE", message: "图标编译服务暂不可用，请稍后重试。", retryable: false }, { status: 503 });
    }
  }
  async function call(stage: string, prompt: string, content: Content[], timeout: number, attempt = 0) {
    sessionSignal.throwIfAborted();
    const begin = Date.now();
    debug.onTrace?.({ stage: "request", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, prompt, input: { stage, task, protocol: libraryProtocol.sha256 }, reference });
    let response: Response;
    let payload: { model?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
    try { response = await fetch(`${base}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: prompt }, { role: "user", content }] }),
      signal: AbortSignal.any([sessionSignal, AbortSignal.timeout(timeout)]),
    });
    if (!response.ok) throw Object.assign(new Error(`Provider ${stage} failed (${response.status})`), { providerStatus: response.status });
    payload = await response.json();
    } catch (error) {
      signal.throwIfAborted();
      const status = error && typeof error === "object" && "providerStatus" in error ? Number(error.providerStatus) : undefined;
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      calls.push({ stage, model, elapsedMs: Date.now() - begin, promptHash: digest(prompt), inputHash: digest(JSON.stringify(content)), outcome: "provider-error" });
      debug.onTrace?.({ stage: "provider-error", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, reference, providerError: { stage, status, timeout } });
      throw Object.assign(new Error(`Provider ${stage} unavailable`), { providerStatus: status ?? 503, providerFailure: true });
    }
    calls.push({ stage, model: typeof payload.model === "string" ? payload.model : model, elapsedMs: Date.now() - begin, promptHash: digest(prompt), inputHash: digest(JSON.stringify(content)), outcome: "success" });
    return json(payload.choices?.[0]?.message?.content);
  }
  const planInput = [asText({ TASK: task, EXISTING_VARIANTS: existing }), ...referenceContent];
  const rawPlan = resume?.context.plan ?? checkpoint?.plan ?? await call("plan", libraryPlanningPrompt(styles), planInput, librarySessionBudgets.plan);
  const parsedPlan = libraryPlanningOutputSchema.safeParse(rawPlan);
  if (!parsedPlan.success) {
    // A malformed plan must remain diagnosable without starting paid drawing calls.
    // Debug sink is local-only, not enabled by public request fields.
    debug.onTrace?.({ stage: "format-error", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt: 0, reference,
      formatError: JSON.stringify({ stage: "plan", issues: parsedPlan.error.issues }), rawOutput: JSON.stringify(rawPlan).slice(0, 100_000) });
    throw parsedPlan.error;
  }
  const plan = parsedPlan.data;
  if (new Set(plan.constructions.map(c => c.style)).size !== styles.length || styles.some(s => !plan.constructions.some(c => c.style === s))) throw new Error("Plan omitted a requested style");
  // Signed checkpoints retain only technically validated variants. Invalid styles
  // cannot evict their successful siblings, including across a manual retry.
  const accepted: Record<string, string> = { ...resume?.variants, ...existing, ...checkpoint?.variants };
  if (Object.keys(accepted).some(style => !styles.includes(style))) throw new Error("Checkpoint contains an unrequested style");
  let pendingStyles = missing.filter(style => !accepted[style]);
  const measurements: Record<string, unknown> = { ...checkpoint?.measurements };
  let outlineSource = resume?.context.outlineSource ?? checkpoint?.outlineSource;
  const savedPlan = () => createLibraryPlanCheckpoint({ inputHash: checkpointInputHash, plan,
    variants: Object.fromEntries(Object.entries(accepted).filter(([style]) => !existing[style])),
    measurements: measurements as Record<string, Record<string, unknown>>, outlineSource,
    calls: [...(checkpoint?.calls ?? []), ...calls].slice(-100) }, key);
  const constructionReference = await libraryConstructionReference(plan.constructionFamily, (options.task as { subject: { name: string; description?: string } }).subject, styles);
  const constructionContent: Content[] = constructionReference ? constructionReference.examples.flatMap(example => [
    asText({ CONSTRUCTION_EXAMPLE: { object: constructionReference.name, family: constructionReference.family, style: example.style, sourceStyle: example.sourceStyle, scope: "different object; local construction methods only, never target anatomy", geometryExample: example.geometryExample } }),
    { type: "image_url" as const, image_url: { url: example.dataUrl, detail: "high" as const } },
  ]) : [];
  // Review gets the same craftsmanship reference as drawing, but no reference SVG
  // source to mistake for evidence about the candidate's actual rendered geometry.
  const reviewConstructionContent: Content[] = constructionReference ? constructionReference.examples.flatMap(example => [
    asText({ CONSTRUCTION_REFERENCE: { object: constructionReference.name, style: example.style, sourceStyle: example.sourceStyle, scope: "Different object, same construction reference used for drawing. Compare contour rhythm, joins and whitespace, never require matching anatomy." } }),
    { type: "image_url" as const, image_url: { url: example.dataUrl, detail: "high" as const } },
  ]) : [];
  debug.onTrace?.({ stage: "result", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt: 0, reference, designCard: plan });
  let variants: Record<string, string> | undefined = resume ? Object.fromEntries(Object.entries(resume.variants).map(([style, svg]) => [style, validateGeneratedSvg(svg)])) : undefined;
  let review: z.infer<typeof libraryReviewSchema> | undefined;
  let reviewStatus: "model-reviewed" | "rework-required" | "pending" = "pending";
  let feedback: unknown;
  let previous: unknown = resume ? { variants: { ...resume.variants, ...(outlineSource ? { outline: outlineSource } : {}) } } : undefined;
  let repairCount = 0;
  let planWarnings: Array<{ style: string; partId: string; defect: string; repair: string }> = [];
  if (resume && variants) {
    for (const style of missing) {
      try {
        const measured = await inspectLibrarySvg(variants[style], style, plan);
        measurements[style] = { ...resume.context.measurements?.[style], ...measured };
        planWarnings.push(...measured.planWarnings.map(warning => ({ style, ...warning })));
      } catch { /* A saved manual transparent paint may have no measurable ink; review the render instead. */ }
    }
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    // Leave time to return preserved candidates. A failed review must not redraw a successful batch.
    if (variants && Date.now() - started > 280_000) break;
    if (!(resume && attempt === 0)) try {
      const repairViews: Content[] = feedback && variants ? [asText({ REPAIR_CANDIDATE: "Actual last valid candidate, not a reference. Compare the reported defect with these rendered images before changing the previous source." }), ...await renderLibraryReview(variants)] : [];
      const frozen = Object.fromEntries(Object.entries(accepted).filter(([style]) => !pendingStyles.includes(style)));
      const raw = pendingStyles.length === 1 && pendingStyles[0] === "outline" && outlineSource
        ? { variants: { outline: outlineSource } }
        : await call(attempt || resume || checkpoint?.variants ? "repair" : "draw", libraryFamilyDrawingPrompt(pendingStyles), [
        asText({ TASK: { ...task, requestedStyles: pendingStyles }, PLAN: plan, EXISTING_VARIANTS: frozen, ...(feedback ? { REPAIR: feedback, PREVIOUS_OUTPUT: previous } : {}) }), ...referenceContent, ...constructionContent,
        ...repairViews,
      ], styles.length > 2 ? librarySessionBudgets.familyDraw : librarySessionBudgets.draw, attempt);
      previous = raw;
      const drawn = drawingSchema.parse(raw).variants;
      // Linear + Outline share one authored centerline, never two independently guessed contours.
      if (pendingStyles.includes("outline") && (drawn.linear || outlineSource)) drawn.outline = drawn.linear ?? outlineSource!;
      const defects: Array<{ style: string; error: string }> = [];
      planWarnings = [];
      for (const style of pendingStyles) {
        try {
        // Inspect geometry before applying user opacity (including fully transparent output).
        const source = drawn[style];
        if (typeof source !== "string" || !source || source.length > 100_000) throw new Error("Requested variant is missing or not a bounded SVG string");
        if (style === "outline") await inspectLibrarySvg(source, "linear", plan);
        const compiled = style === "outline" ? await compileLibraryOutline(source) : undefined;
        const geometry = compiled?.svg ?? source;
        const measured = await inspectLibrarySvg(geometry, style, plan);
        measurements[style] = { ...measured, ...(compiled ? { compilation: compiled.evidence } : {}) };
        planWarnings.push(...measured.planWarnings.map(warning => ({ style, ...warning })));
        const manual = colors as { default?: { mode?: string; color?: string; alpha?: number }; mode?: string } | undefined;
        const ink = manual?.default?.mode === "solid" ? manual.default.color : undefined;
        const alpha = manual?.mode === "manual" && typeof manual.default?.alpha === "number" ? Math.max(0, Math.min(1, manual.default.alpha / 100)) : 1;
        const painted = applyLockedSolidColor(geometry, ink && /^#[0-9a-f]{6}$/i.test(ink) ? ink : "#343A40", alpha);
        accepted[style] = validateGeneratedSvg(applyLockedGradient(painted, colors, `six-${crypto.randomUUID()}`));
        if (styles.includes("outline") && (style === "linear" || style === "outline")) outlineSource = source;
        } catch (error) {
          defects.push({ style, error: error instanceof Error ? error.message : "Invalid geometry" });
        }
      }
      pendingStyles = defects.map(defect => defect.style);
      if (pendingStyles.includes("linear") && styles.includes("outline") && !existing.outline) {
        pendingStyles = [...new Set([...pendingStyles, "outline"])];
        delete accepted.outline;
        delete measurements.outline;
      }
      if (defects.length) {
        feedback = { technicalErrors: defects, action: "Repair only the failed styles; all validated siblings remain frozen" };
        debug.onTrace?.({ stage: "format-error", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, reference, formatError: JSON.stringify(feedback) });
        if (sessionSignal.aborted || attempt === 2) break;
        continue;
      }
      variants = { ...accepted };
      repairCount = resume ? repairCount + 1 : attempt;
      // Any newly drawn SVG invalidates the previous review, including its hash binding.
      review = undefined; reviewStatus = "pending";
      debug.onTrace?.({ stage: "result", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, reference, designCard: plan,
        rawSvgs: Object.fromEntries(Object.entries(drawn).filter((entry): entry is [string, string] => typeof entry[1] === "string")), finalSvgs: variants });
    } catch (error) {
      signal.throwIfAborted();
      if (error && typeof error === "object" && "providerFailure" in error) {
        // Network failures are not evidence that the geometry is wrong. No model repair loop.
        if (!variants) return Response.json({ error: "SVG_PROVIDER_FAILED", message: "绘图服务暂时无响应，规划已保存；请稍后重试，将从绘图阶段继续。", retryable: false, planCheckpoint: savedPlan(), details: { providerStatus: "providerStatus" in error ? error.providerStatus : 503, calls } }, { status: 503 });
        break;
      }
      feedback = { technicalError: error instanceof Error ? error.message : "Invalid geometry", action: "Repair the invalid variant, preserving PLAN and all valid semantic parts" };
      debug.onTrace?.({ stage: "format-error", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, reference, formatError: JSON.stringify(feedback), rawOutput: JSON.stringify(previous)?.slice(0, 100_000) });
      if (sessionSignal.aborted || attempt === 2) break;
      continue;
    }
    if (!variants) break;
    try {
      review = parseLibraryReview(await call("review", `${libraryReviewPrompt}\nEach issue.style MUST be one exact key from: ${styles.join(", ")}. Put theme scope in location, never in style. Report shared defects as one issue per affected style.`, [
        asText({ intendedTask: task, plan, measurements, allocationWarnings: planWarnings, allocationPolicy: "Bounds are a planning proposal, not an aesthetic target. A local overflow can be an optical correction. Request repair only when the actual image has a visible defect; never shrink a valid joint merely to fit a guessed box.", frozenStyles: Object.keys(existing) }),
        ...referenceContent, ...reviewConstructionContent, ...await renderLibraryReview(variants),
      ], librarySessionBudgets.review, attempt), styles);
      reviewStatus = review.issues.length ? "rework-required" : "model-reviewed";
      debug.onTrace?.({ stage: "visual-review", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, reference, visualReview: review });
      if (!review.issues.length) break;
      feedback = { issues: review.issues, pairConsistency: review.pairConsistency, instruction: "Correct visible defects of missing styles only. Do not reinterpret the requested subject. Existing variants stay frozen." };
      // A frozen source needs user-directed regeneration, not endless changes to its partner.
      if (review.issues.every(issue => existing[issue.style])) break;
      pendingStyles = [...new Set(review.issues.filter(issue => !existing[issue.style]).map(issue => issue.style))];
      // Outline is a compiled version of the same authored Linear centerline.
      if (pendingStyles.some(style => style === "linear" || style === "outline") && styles.includes("linear") && styles.includes("outline")) {
        pendingStyles = [...new Set([...pendingStyles, ...["linear", "outline"].filter(style => !existing[style])])];
      }
    } catch (error) {
      signal.throwIfAborted();
      reviewStatus = "pending";
      debug.onTrace?.({ stage: "review-error", version: LIBRARY_SESSION_VERSION, styleId: styles.join("+"), model, attempt, reference, finalSvgs: variants, reviewError: error instanceof Error ? error.message : "Review unavailable" });
      break;
    }
  }
  signal.throwIfAborted();
  if (!variants) return Response.json({ error: "INVALID_LIBRARY_GEOMETRY", message: "主体结构尚未生成完整，规划已保存；重试将从绘图阶段继续。", retryable: false, planCheckpoint: savedPlan(), details: { plan, feedback } }, { status: 422 });
  return Response.json({ svg: variants[styles[0]], variants, styleId: styles[0], designCard: plan, reference,
    authoringProtocol: LIBRARY_SESSION_VERSION, reviewStatus,
    generationContext: { version: LIBRARY_SESSION_VERSION, protocolRevision: libraryProtocol.revision, protocolHash: libraryProtocol.sha256,
      plan, subjectKey, constructionReference: constructionReference ? { family: constructionReference.family, id: constructionReference.id, scope: "different-object-construction", examples: constructionReference.examples.map(({ style, sourceStyle, sha256 }) => ({ style, sourceStyle, sha256 })) } : null,
      references: references.map(ref => ref ? { source: ref.source, sha256: ref.sha256 } : null), calls: [...(resume?.context.calls ?? checkpoint?.calls ?? []), ...calls].slice(-100), repairCount: (resume?.context.repairCount ?? 0) + repairCount,
      resumedFromPlan: checkpoint ? { inputHash: checkpoint.inputHash } : undefined,
      resumedFrom: resume ? { version: resume.context.version, finalHashes: resume.context.finalHashes } : undefined, measurements,
      ...(outlineSource ? { outlineSource, outlineSourceHash: digest(outlineSource) } : {}),
      finalHashes: Object.fromEntries(Object.entries(variants).map(([style, svg]) => [style, digest(svg)])), reviewStatus, review, elapsedMs: Date.now() - started },
  });
}
