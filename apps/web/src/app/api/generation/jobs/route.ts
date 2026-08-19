import { createGenerationSchema } from "@icongen/shared";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createGenerationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_GENERATION_REQUEST", details: parsed.error.flatten() }, { status: 400 });
  }

  return Response.json(
    { error: "NOT_IMPLEMENTED", message: "Credit transaction and SQS publishing are not connected yet." },
    { status: 501 },
  );
}
