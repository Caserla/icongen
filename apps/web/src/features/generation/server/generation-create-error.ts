export type GenerationRuntimeLimitError = {
  code: string;
  message: string;
  status: number;
};

export function generationRuntimeLimitError(
  message: string,
): GenerationRuntimeLimitError | null {
  if (message.includes("GENERATION_GLOBAL_CONCURRENCY_LIMIT")) {
    return {
      code: "GENERATION_CAPACITY_REACHED",
      message: "Generation is at capacity. Please try again shortly.",
      status: 503,
    };
  }
  if (message.includes("GENERATION_GLOBAL_DAILY_LIMIT")) {
    return {
      code: "GENERATION_BUDGET_PAUSED",
      message: "Generation is temporarily paused for today.",
      status: 503,
    };
  }
  if (message.includes("GENERATION_GLOBAL_MONTHLY_LIMIT")) {
    return {
      code: "GENERATION_BUDGET_PAUSED",
      message: "Generation is temporarily paused.",
      status: 503,
    };
  }
  if (message.includes("GENERATION_USER_DAILY_LIMIT")) {
    return {
      code: "GENERATION_DAILY_LIMIT_REACHED",
      message: "You have reached today's generation limit.",
      status: 429,
    };
  }
  return null;
}
