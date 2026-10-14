import {requireAdminUser} from "@/features/admin/server/admin-auth";
import {adminErrorResponse} from "@/features/admin/server/admin-response";
import {apiError} from "@/lib/http/api-response";
import {createAdminSupabaseClient} from "@/lib/supabase/admin";
export async function GET(){try{await requireAdminUser();const client=createAdminSupabaseClient();const results=await Promise.all(['profiles','icon_projects','project_svg_icons'].map(table=>client.from(table).select('*',{count:'exact',head:true})));if(results.some(r=>r.error))throw Error('Query failed');return Response.json({users:results[0].count??0,projects:results[1].count??0,icons:results[2].count??0},{headers:{'Cache-Control':'private, no-store'}});}catch(error){return adminErrorResponse(error)??apiError('ADMIN_OVERVIEW_FAILED','Overview unavailable.',500);}}
