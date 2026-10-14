/** Local debug sink only; never enabled by request body or returned credentials. */
export type GenerationTrace = {
  stage: "request" | "result" | "format-error" | "visual-review" | "review-error" | "provider-error";
  styleId: string;
  version: string;
  model: string;
  attempt: number;
  prompt?: string;
  input?: unknown;
  reference: { source: string; sha256: string } | null;
  designCard?: unknown;
  rawSvgs?: Record<string, string>;
  finalSvgs?: Record<string, string>;
  geometry?: unknown;
  constructedGeometry?: unknown;
  assembledSvgs?: Record<string, string>;
  formatError?: string;
  rawOutput?: string;
  visualReview?: unknown;
  reviewError?: string;
  providerError?: { stage: string; status?: number; timeout: boolean };
};

export type GenerationDebugOptions = {
  onTrace?: (trace: GenerationTrace) => void;
  /** Offline acceptance only; cannot be supplied by a public request body. */
  providerTimeoutMs?: number;
  /** Legacy styles only: six library styles always run a bounded rendered review session. */
  requireVisualReview?: boolean;
  /** Offline comparison override; production uses front geometry by default. */
  experimentalIsometricExtrusion?: boolean;
  /** Offline comparison override; production uses semantic strokes by default. */
  experimentalDoodleGeometry?: boolean;
};
