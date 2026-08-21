import { requireUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(){try{await requireUser();const supabase=await createServerSupabaseClient();const{error}=await supabase.rpc("cancel_account_deletion");if(error)return apiError("ACCOUNT_DELETION_CANCEL_FAILED","We could not cancel account deletion.",500);return Response.json({status:"active"})}catch(error){return authErrorResponse(error)??apiError("ACCOUNT_DELETION_CANCEL_FAILED","We could not cancel account deletion.",500)}}
