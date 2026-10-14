import { generateSvgIconResponse } from "@/features/generation/server/generate-svg-icon";
import { withSvgProviderCapacity } from "@/features/generation/server/svg-provider-capacity";

export const maxDuration = 420;

export async function POST(request: Request) {
  const { requireActiveUser } = await import("@/lib/auth/require-user");
  const { authErrorResponse } = await import("@/lib/http/api-response");
  try { await requireActiveUser(); }
  catch (error) { return authErrorResponse(error) ?? Response.json({ error: "AUTH_FAILED", message: "Authentication failed" }, { status: 401 }); }
  const requestId = crypto.randomUUID();
  return withSvgProviderCapacity(() => generateSvgIconResponse(request, {
    onTrace(trace) {
      // Keep operational diagnosis, never prompts, user descriptions, images or SVG bodies.
      if (trace.providerError || trace.formatError || trace.reviewError) {
        console.warn("[svg-generation]", JSON.stringify({ requestId, stage: trace.stage,
          attempt: trace.attempt, providerError: trace.providerError,
          formatError: trace.formatError?.slice(0, 4000), reviewError: trace.reviewError?.slice(0, 500) }));
      }
    },
  }));
}
