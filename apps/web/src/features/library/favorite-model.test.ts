import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalog,styles} from './core';
import {assetId,findAsset} from './favorite-model';
test('favorites have a unique key for every design/style/version',()=>{
 const ids=catalog.flatMap(d=>styles.map(s=>assetId(d.id,s,d.version)));
 assert.equal(new Set(ids).size,catalog.length*styles.length);
 for(const id of ids)assert.equal(findAsset(id)?.id,id);
});
test('unknown styles, versions and injected keys cannot be added',()=>{
 const d=catalog[0];
 for(const key of [null,{},`${d.id}:invalid:${d.version}`,`${d.id}:linear:old`,`${d.id}:linear:${d.version}:extra`])assert.equal(findAsset(key),undefined);
});
