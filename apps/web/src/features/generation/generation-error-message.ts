export function generationErrorMessage(error: unknown, zh: boolean) {
  const message = error instanceof Error ? error.message.trim() : "";
  return message || (zh ? "生成请求失败，请稍后重试。" : "Generation request failed. Please try again.");
}
