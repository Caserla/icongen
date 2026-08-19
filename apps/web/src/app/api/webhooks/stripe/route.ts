export function POST() {
  return Response.json(
    { error: "NOT_IMPLEMENTED", message: "Webhook signature verification is required before enabling this route." },
    { status: 501 },
  );
}
