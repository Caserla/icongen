import JSZip from "jszip";
import { requireUser } from "@/lib/auth/require-user";
import { authErrorResponse, apiError } from "@/lib/http/api-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(){
  try{
    const user=await requireUser(); const supabase=await createServerSupabaseClient();
    const[profile,orders,ledger,jobs,subjects,variants,assets]=await Promise.all([
      supabase.from("profiles").select("*").eq("id",user.id).single(),
      supabase.from("orders").select("*").eq("user_id",user.id),
      supabase.from("credit_ledger").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      supabase.from("generation_jobs").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      supabase.from("generation_subjects").select("*"),
      supabase.from("generation_variants").select("*"),
      supabase.from("generation_assets").select("*"),
    ]);
    const failed=[profile,orders,ledger,jobs,subjects,variants,assets].find((result)=>result.error);
    if(failed?.error)return apiError("ACCOUNT_EXPORT_FAILED","We could not prepare your account export.",500);
    const zip=new JSZip(); const generatedAt=new Date().toISOString();
    zip.file("account.json",JSON.stringify({generatedAt,user:{id:user.id,email:user.email,emailVerifiedAt:user.email_confirmed_at},profile:profile.data},null,2));
    zip.file("orders.json",JSON.stringify(orders.data,null,2)); zip.file("credit-ledger.json",JSON.stringify(ledger.data,null,2));
    zip.file("generation-jobs.json",JSON.stringify(jobs.data,null,2)); zip.file("generation-subjects.json",JSON.stringify(subjects.data,null,2));
    const safeVariants=(variants.data??[]).map((variant)=>Object.fromEntries(Object.entries(variant).filter(([key])=>key!=="prompt")));
    zip.file("generation-variants.json",JSON.stringify(safeVariants,null,2)); zip.file("asset-manifest.json",JSON.stringify(assets.data,null,2));
    const body=await zip.generateAsync({type:"arraybuffer",compression:"DEFLATE"});
    return new Response(body,{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="bamboo-icongen-account-${generatedAt.slice(0,10)}.zip"`,"Cache-Control":"private, no-store"}});
  }catch(error){return authErrorResponse(error)??apiError("ACCOUNT_EXPORT_FAILED","We could not prepare your account export.",500)}
}
