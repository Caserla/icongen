import { requireActiveUser } from '@/lib/auth/require-user';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { apiError, authErrorResponse } from '@/lib/http/api-response';
import { findAsset } from '@/features/library/favorite-model';

export async function GET() {
  try {
    const user = await requireActiveUser();
    const client = await createServerSupabaseClient();
    const items=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await client.from('library_favorites').select('asset_id,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).order('asset_id').range(offset,offset+499);
      if(error)throw error;
      items.push(...(data??[]));
      if(!data||data.length<500)break;
    }
    return Response.json({items},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return authErrorResponse(error) ?? apiError('LIBRARY_FAVORITES_UNAVAILABLE','Favorites are unavailable. Please check the library migration.',503); }
}
async function mutate(request:Request,remove:boolean) {
  try {
    const user = await requireActiveUser();
    const body = await request.json().catch(()=>null);
    // Never accept user_id from the browser. Unknown/retired assets can still be removed.
    if (!body || typeof body.assetId !== 'string' || body.assetId.length>180 || (!remove && !findAsset(body.assetId))) return apiError('INVALID_ASSET','Invalid library asset.',400);
    const client = await createServerSupabaseClient();
    const {error} = remove
      ? await client.from('library_favorites').delete().eq('user_id',user.id).eq('asset_id',body.assetId)
      : await client.from('library_favorites').upsert({user_id:user.id,asset_id:body.assetId},{onConflict:'user_id,asset_id',ignoreDuplicates:true});
    if(error) throw error;
    return new Response(null,{status:204,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return authErrorResponse(error) ?? apiError('LIBRARY_FAVORITES_UNAVAILABLE','Favorites could not be updated.',503);}
}
export async function PUT(request:Request){return mutate(request,false);}
export async function DELETE(request:Request){return mutate(request,true);}
