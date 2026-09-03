import { isCreditCodeShapeValid, normalizeCreditCode } from "@/lib/credits";
import { requireActiveUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const redeemErrors: Record<string, { status: number; message: string }> = {
  INVALID_CD_KEY: { status: 400, message: "This CD-Key is invalid." },
  CD_KEY_DISABLED: { status: 409, message: "This CD-Key is no longer available." },
  CD_KEY_ALREADY_REDEEMED: { status: 409, message: "This CD-Key has already been redeemed." },
  CD_KEY_EXPIRED: { status: 410, message: "This CD-Key has expired." },
};

export async function POST(request: Request) {
  try {
    await requireActiveUser();
    const body = await request.json().catch(() => null) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? normalizeCreditCode(body.code) : "";
    if (!isCreditCodeShapeValid(code)) return apiError("INVALID_CD_KEY", redeemErrors.INVALID_CD_KEY.message, 400);

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("redeem_credit_code", { p_code: code });
    if (error) {
      const codeName = Object.keys(redeemErrors).find((key) => error.message.includes(key));
      if (codeName) {
        const known = redeemErrors[codeName];
        return apiError(codeName, known.message, known.status);
      }
      return apiError("CD_KEY_REDEEM_FAILED", "The CD-Key could not be redeemed. Try again.", 500);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) return apiError("CD_KEY_REDEEM_FAILED", "The CD-Key could not be redeemed. Try again.", 500);
    return Response.json({ credits: result.granted_credits, balance: result.new_balance });
  } catch (error) {
    return authErrorResponse(error) ?? apiError("CD_KEY_REDEEM_FAILED", "The CD-Key could not be redeemed. Try again.", 500);
  }
}
