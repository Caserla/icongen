import { AdminAuthorizationError } from "./admin-auth";
import { authErrorResponse, apiError } from "@/lib/http/api-response";

export function adminErrorResponse(error: unknown) {
  return (
    authErrorResponse(error) ??
    (error instanceof AdminAuthorizationError
      ? apiError("ADMIN_REQUIRED", "Administrator access is required.", 403)
      : null)
  );
}
