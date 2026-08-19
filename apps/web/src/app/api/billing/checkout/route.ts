import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";

export async function POST() {
  try {
    await requireActiveUser();
  } catch (error) {
    return authErrorResponse(error) ?? apiError("AUTHORIZATION_FAILED", "We could not verify this account.", 500);
  }
  return Response.json(
    { error: "NOT_IMPLEMENTED", message: "Stripe Checkout integration is not connected yet." },
    { status: 501 },
  );
}
