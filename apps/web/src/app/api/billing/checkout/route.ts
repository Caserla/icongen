export function POST() {
  return Response.json(
    { error: "NOT_IMPLEMENTED", message: "Stripe Checkout integration is not connected yet." },
    { status: 501 },
  );
}
