import { AuthError } from "@/lib/auth/require-user";

export function apiError(code: string, message: string, status: number, details?: unknown) {
  return Response.json({ error: code, message, ...(details === undefined ? {} : { details }) }, { status });
}

export function authErrorResponse(error: unknown) {
  if (!(error instanceof AuthError)) return null;
  const status = error.code === "AUTH_REQUIRED" ? 401 : 403;
  return apiError(error.code, error.message, status);
}

