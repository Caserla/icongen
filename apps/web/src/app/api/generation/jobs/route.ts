import { createGenerationSchema } from "@icongen/shared";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_GENERATION_REQUEST", "Please check the generation request.", 400, parsed.error.flatten());
  }

  try {
    await requireActiveUser();
  } catch (error) {
    return authErrorResponse(error) ?? apiError("AUTHORIZATION_FAILED", "We could not verify this account.", 500);
  }

  return Response.json(
    { error: "NOT_IMPLEMENTED", message: "Credit transaction and SQS publishing are not connected yet." },
    { status: 501 },
  );
}
