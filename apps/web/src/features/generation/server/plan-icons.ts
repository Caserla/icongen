import { ICON_PLAN_PROMPT, normalizeIconPlan } from "../icon-plan";
import { ICON_GENERATION_CATEGORIES } from "../icon-generation-categories";
import { buildGenerationBrief, INTENT_EXTRACTION_PROMPT, needsIntentResolution } from "../generation-intent";
import type { GenerationSnapshot } from "../generation-snapshot";
import { prepareGenerationDraft } from "./prepare-generation-draft";

export const PLANNER_PIPELINE_VERSION = "compact-2-library-pair";
type VerifiedInput = GenerationSnapshot & { prompt: string; locale: "zh" | "en" };
export class IconPlanProviderError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) { super(message); }
}

/** Production and local acceptance share this exact planner. Auth/project ownership
 * stays in the route; callers must supply already verified project context. */
export async function planIcons(input: VerifiedInput, options: {
  referenceDataUrl?: string;
  signal?: AbortSignal;
  onTrace?: (event: Record<string, unknown>) => void;
  /** Offline acceptance only; public route keeps the 75-second default. */
  timeoutMs?: number;
} = {}) {
  const base = process.env.IMAGE_PROVIDER_BASE_URL?.replace(/\/$/, "");
  const key = process.env.IMAGE_PROVIDER_API_KEY;
  if (!base || !key) throw new IconPlanProviderError("PROVIDER_UNAVAILABLE", "Model provider is not configured.", 503);
  const model = process.env.ICON_PLANNER_MODEL || "gpt-5.6-sol";
  const styles = ICON_GENERATION_CATEGORIES.flatMap(category => category.children.map(child => ({ id: child.id, name: child.label })));
  const content: Array<Record<string, unknown>> = [{ type: "text", text: JSON.stringify(input) }];
  if (options.referenceDataUrl) content.push({ type: "image_url", image_url: { url: options.referenceDataUrl } });
  const messages = [{ role: "system", content: `${ICON_PLAN_PROMPT}\n${INTENT_EXTRACTION_PROMPT}\nSUPPORTED_STYLES: ${JSON.stringify(styles)}\nExtract requirements only. Do not design geometry, structureBlueprint or SVG. Selected main style is input.styleId; optional input.secondaryStyleId requests a separate same-subject variant. Preserve both selections; report genuine conflicts rather than silently overriding them.` }, { role: "user", content }];
  options.onTrace?.({ phase: "planner-request", version: PLANNER_PIPELINE_VERSION, model, messages });
  const timeoutMs = Number.isInteger(options.timeoutMs) ? Math.min(180_000, Math.max(75_000, options.timeoutMs!)) : 75_000;
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, response_format: { type: "json_object" }, messages }), signal });
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    throw new IconPlanProviderError("PLAN_PROVIDER_FAILED", retryable ? "需求解析模型暂时不可用，请稍后重试。" : "需求解析模型配置无效，请检查当前模型。", retryable ? 503 : 502, { model, providerStatus: response.status });
  }
  const payload = await response.json();
  const planned = JSON.parse(payload.choices?.[0]?.message?.content ?? "");
  const plan = normalizeIconPlan(planned);
  if (input.secondaryStyleId && plan.subjects.length > 20) throw new IconPlanProviderError("TOO_MANY_SUBJECTS", "双风格一次最多支持 20 个主体（40 张图标）。", 400);
  const designBrief = buildGenerationBrief(planned.designIntent, input);
  const snapshot = { ...input, designBrief, ...(options.referenceDataUrl ? { referenceImage: options.referenceDataUrl, referenceUse: plan.referenceUse } : {}) };
  options.onTrace?.({ phase: "planner-result", model, planned, designBrief });
  if (needsIntentResolution(designBrief)) return { plan, snapshot, needsResolution: true as const };
  try { return { ...prepareGenerationDraft(plan, snapshot), needsResolution: false as const }; }
  catch (error) {
    const message = error instanceof Error ? error.message : "Please review the generation requirements.";
    return { plan, snapshot: { ...snapshot, designBrief: { ...designBrief, styleRequest: {
      kind: "unsupported" as const, evidence: designBrief.colorIntent.evidence || input.prompt.slice(0, 800), message,
    } } }, needsResolution: true as const };
  }
}
