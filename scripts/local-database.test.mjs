import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createLocalClient, LOCAL_USER_ID} from '../apps/web/src/lib/local/database.mjs';

test('local projects, variants, favorites and recycle survive readback and cascade', async () => {
  const directory = mkdtempSync(join(tmpdir(),'easy-icon-sqlite-test-'));
  try {
    const client = createLocalClient(directory);
    const project = await client.from('icon_projects').insert({user_id:LOCAL_USER_ID,name:'Test',description:'Example'}).select('id,name').single();
    assert.equal(project.error,null);
    const readAfterRestart = execFileSync(process.execPath,['--input-type=module','-e',`import {createLocalClient} from ${JSON.stringify(new URL('../apps/web/src/lib/local/database.mjs',import.meta.url).href)}; const result=await createLocalClient(${JSON.stringify(directory)}).from('icon_projects').select('id').single(); console.log(result.data.id);`],{encoding:'utf8'}).trim();
    assert.equal(readAfterRestart,project.data.id);
    assert.equal((await client.from('icon_projects').insert({user_id:LOCAL_USER_ID,name:'test'})).error.code,'23505');
    const set = await client.from('project_svg_icon_sets').insert({project_id:project.data.id,user_id:LOCAL_USER_ID,plan:{subjects:[]},snapshot:{}}).select('id').single();
    const saved = await client.from('project_svg_icons').upsert({set_id:set.data.id,subject_id:'home',svg:'<svg/>',style_variants:{linear:'<svg/>',bold:'<svg/>'}},{onConflict:'set_id,subject_id'});
    assert.equal(saved.error,null);
    await client.from('project_svg_icons').update({is_favorite:true}).eq('set_id',set.data.id).eq('subject_id','home');
    await client.from('project_svg_icons').update({is_favorite:false,recycled_at:'2026-10-14T00:00:00Z'}).eq('set_id',set.data.id);
    assert.equal((await client.from('project_svg_icons').select('svg,is_favorite,style_variants').eq('set_id',set.data.id).single()).data.is_favorite,false);
    await client.from('project_svg_icons').update({recycled_at:null}).eq('set_id',set.data.id);
    const restored = await createLocalClient(directory).from('project_svg_icons').select('svg,style_variants').eq('set_id',set.data.id).is('recycled_at',null).single();
    assert.deepEqual(restored.data.style_variants,{linear:'<svg/>',bold:'<svg/>'});
    await client.from('library_favorites').upsert({user_id:LOCAL_USER_ID,asset_id:'smile'},{onConflict:'user_id,asset_id',ignoreDuplicates:true});
    await client.from('library_favorites').upsert({user_id:LOCAL_USER_ID,asset_id:'smile'},{onConflict:'user_id,asset_id',ignoreDuplicates:true});
    assert.equal((await client.from('library_favorites').select('*')).data.length,1);
    await client.from('icon_projects').delete().eq('id',project.data.id);
    assert.equal((await client.from('project_svg_icons').select('*')).data.length,0);
    assert.equal((await client.from('project_svg_icon_sets').select('*')).data.length,0);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('atomic upsert preserves prior styles; invalid parent rolls back batch', async () => {
  const directory = mkdtempSync(join(tmpdir(),'easy-icon-sqlite-test-'));
  try {
    const client = createLocalClient(directory);
    const project = await client.from('icon_projects').insert({user_id:LOCAL_USER_ID,name:'Atomic'}).select('id').single();
    const set = await client.from('project_svg_icon_sets').insert({user_id:LOCAL_USER_ID,project_id:project.data.id}).select('id').single();
    await client.from('project_svg_icons').upsert({set_id:set.data.id,subject_id:'a',svg:'A',style_variants:{bold:'B'}});
    await client.from('project_svg_icons').upsert({set_id:set.data.id,subject_id:'a',svg:'C'});
    assert.equal((await client.from('project_svg_icons').select('*').single()).data.style_variants.bold,'B');
    const result = await client.from('project_svg_icons').upsert([{set_id:set.data.id,subject_id:'b',svg:'B'},{set_id:'missing',subject_id:'c',svg:'C'}]);
    assert.ok(result.error);
    assert.equal((await client.from('project_svg_icons').select('*')).data.length,1);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
