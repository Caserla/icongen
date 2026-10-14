import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
const base = 'http://127.0.0.1:3000';
async function request(path, method = 'GET', body) {
  const response = await fetch(base+path,{method,headers:{origin:base,'content-type':'application/json'},...(body ? {body:JSON.stringify(body)} : {})});
  const result = await response.json();
  assert.ok(response.ok,`${method} ${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
const account = await request('/api/account');
assert.equal(account.id,'00000000-0000-4000-8000-000000000001','Only run against SQLite local mode');
assert.equal((await fetch(base+'/create')).status,200);
assert.equal((await fetch(base+'/library')).status,200);
assert.equal(await new Promise((resolve,reject)=>{const req=httpRequest(base+'/api/projects',{headers:{host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
assert.equal((await fetch(base+'/api/projects',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'})).status,403);
console.log('PASS pages without login, loopback and origin protection');
const {item:project} = await request('/api/projects','POST',{name:`SQLite test ${Date.now()}`,description:'Local disposable test'});
const path = `/api/projects/${project.id}`;
try {
  const subjects = [{id:'test-home',name:'Home',description:'Home'},{id:'test-star',name:'Favorite',description:'Favorite'}];
  const plan = {recognizable:true,intent:'explicit_subjects',referenceUse:'none',summary:'Local persistence test',subjects,count:2,fallback:false};
  const set = await request(path+'/svg-sets','POST',{plan,snapshot:{projectId:project.id,prompt:'Home and Favorite',styleId:'linear',styleFamily:true,theme:'light'}});
  const setPath = path+'/svg-sets/'+set.id;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 12 12 4 20 12V20H4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const styles = Object.fromEntries(['linear','outline','bold','broken','bulk','twotone'].map(style=>[style,svg]));
  const hash = createHash('sha256').update(svg).digest('hex');
  await request(setPath+'/icons','PUT',{subjectId:subjects[0].id,svg,styleVariants:styles,generationContext:{version:'local-test-fixture',protocolHash:'0'.repeat(64),reviewStatus:'pending',finalHashes:Object.fromEntries(Object.keys(styles).map(style=>[style,hash]))}});
  await request(setPath+'/icons/'+subjects[0].id,'PATCH',{favorite:true});
  let listed = await request(path+'/svg-sets');
  assert.equal(listed.items.find(item=>item.id === set.id).icons[subjects[0].id],svg);
  await request(setPath+'/icons/'+subjects[0].id,'PATCH',{recycled:true});
  assert.ok(JSON.stringify(await request(path+'/recycle-bin')).includes('test-home'));
  await request(setPath+'/icons/'+subjects[0].id,'PATCH',{recycled:false});
  const variants = await request(setPath+'/icons/'+subjects[0].id);
  assert.deepEqual(variants.variants,styles);
  await request(setPath,'PATCH',{favorite:true});
  await request(setPath,'PATCH',{recycled:true});
  await request(setPath,'PATCH',{recycled:false});
  console.log('PASS project, set, six-style persistence, favorite and recycle restore APIs (fixture SVG; no model request)');
} finally {
  await request(path,'DELETE');
  console.log('Removed only the disposable test project');
}
