// Shared across tabs and hot reloads in this server process. Multi-instance
// deployment requires a database-backed lease instead of this local semaphore.
const runtime = globalThis as typeof globalThis & { svgProviderActive?: number };
export async function withSvgProviderCapacity(run: () => Promise<Response>) {
  if ((runtime.svgProviderActive ?? 0) >= 2) return Response.json({ error: "PROVIDER_BUSY", message: "生成服务繁忙，稍后自动重试。" }, { status: 429, headers: { "Retry-After": "15" } });
  runtime.svgProviderActive = (runtime.svgProviderActive ?? 0) + 1;
  try { return await run(); }
  finally { runtime.svgProviderActive = Math.max(0, (runtime.svgProviderActive ?? 1) - 1); }
}
