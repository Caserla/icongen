import { deleteAccountRequestSchema } from "@icongen/shared";
import { requireUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("account_deletion_requests")
      .select("id,status,requested_at,scheduled_deletion_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return apiError("ACCOUNT_DELETION_REQUEST_LOAD_FAILED", "We could not load the deletion request.", 500);
    return Response.json(data ? {
      requestId: data.id,
      status: data.status,
      requestedAt: data.requested_at,
      scheduledDeletionAt: data.scheduled_deletion_at,
    } : { status: "none" });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("ACCOUNT_DELETION_REQUEST_LOAD_FAILED", "We could not load the deletion request.", 500);
  }
}

export async function POST(request: Request) {
  const parsed = deleteAccountRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Confirm deletion with DELETE and your password.", 400, parsed.error.flatten());

  try {
    const user = await requireUser();
    if (!user.email) return apiError("REAUTH_REQUIRED", "Password confirmation is required.", 401);
    const supabase = await createServerSupabaseClient();
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (reauthError) return apiError("REAUTH_REQUIRED", "Password confirmation failed.", 401);

    const { data, error } = await supabase.rpc("request_account_deletion", {
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (error?.message.includes("active generation")) {
      return apiError("ACTIVE_GENERATION_EXISTS", "Wait for active icon generations to finish.", 409);
    }
    if (error) return apiError("ACCOUNT_DELETION_REQUEST_FAILED", "We could not submit the deletion request.", 500);
    const requestRecord = await supabase.from("account_deletion_requests").select("scheduled_deletion_at").eq("id", data).single();
    if (requestRecord.error) return apiError("ACCOUNT_DELETION_REQUEST_FAILED", "We could not load the deletion deadline.", 500);
    return Response.json({ requestId: data, status: "deletion_pending", scheduledDeletionAt: requestRecord.data.scheduled_deletion_at }, { status: 202 });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("ACCOUNT_DELETION_REQUEST_FAILED", "We could not submit the deletion request.", 500);
  }
}
