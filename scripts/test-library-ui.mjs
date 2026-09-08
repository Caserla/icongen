// Isolated real-browser component checks. Does not bypass production auth or
// claim deployed/Supabase acceptance; only router + locale are test adapters.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=process.cwd();
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{LibraryBrowser}from './apps/web/src/features/library/library-browser';createRoot(document.getElementById('root')).render(<LibraryBrowser/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,outdir:'out',jsx:'automatic',alias:{'@':resolve('apps/web/src')},plugins:[{name:'test-context',setup(b){b.onResolve({filter:/^(next\/navigation|@\/components\/i18n\/locale-provider)$/},args=>({path:args.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},args=>({loader:'js',resolveDir:root,contents:args.path==='next/navigation'?`import{useSyncExternalStore}from'react';const listen=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};for(const key of ['pushState','replaceState']){const old=history[key].bind(history);history[key]=(...args)=>{old(...args);window.dispatchEvent(new Event('popstate'))}}export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(listen,()=>location.search,()=>''))}`:`export const useLocale=()=>({locale:'zh',t:key=>key});`}));}}]});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const globals=readFileSync('apps/web/src/app/globals.css','utf8');
const guides=(await postcss([tailwind()]).process(globals,{from:resolve('apps/web/src/app/globals.css')})).css;
const server=createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(js)}if(path.startsWith('/library/samples/')){try{const file=resolve('apps/web/public'+decodeURIComponent(path));if(!file.startsWith(resolve('apps/web/public/library/samples')+'/'))throw Error();res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'application/json');return res.end(readFileSync(file))}catch{res.statusCode=404;return res.end()}}res.setHeader('Content-Type','text/html');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#101012;font-family:Arial,sans-serif}button,input,select{font:inherit}${css}${guides}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.E2E_BROWSER_CHANNEL ?? 'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const favorites=new Set();
let failMutation=false;
await page.route('**/api/library/favorites',async route=>{
 const request=route.request();
 if(request.method()==='GET')return route.fulfill({json:{items:[...favorites].map(asset_id=>({asset_id,created_at:new Date().toISOString()}))}});
 if(failMutation)return route.fulfill({status:503,json:{error:'test failure'}});
 const {assetId}=request.postDataJSON();
 if(request.method()==='PUT')favorites.add(assetId);else favorites.delete(assetId);
 return route.fulfill({status:204});
});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('outputs/library-ui',{recursive:true});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/library`);
 assert.equal(await page.locator('button[aria-label$="· linear"]').count(),24);
 await page.getByRole('searchbox').fill('钥匙');
 assert.equal(await page.locator('button[aria-label$="· linear"]').count(),1);
 await page.getByRole('button',{name:'钥匙 · linear',exact:true}).click();
 await page.locator('dialog img[alt="钥匙"]').waitFor();
 const codeBox=page.getByRole('textbox',{name:'实时代码内容',exact:true});
 assert.ok(await codeBox.evaluate(el=>el.scrollWidth<=el.clientWidth));
 const tabsBox=await page.getByLabel('代码格式',{exact:true}).boundingBox();
 const previewBox=await page.locator('dialog img[alt="钥匙"]').boundingBox();
 assert.ok(tabsBox.y+tabsBox.height<previewBox.y);
 await page.screenshot({path:'outputs/library-ui/detail-desktop.png'});
 await page.locator('dialog').getByRole('button',{name:'bold',exact:true}).click();
 await page.getByLabel('输出尺寸').selectOption('128');
 await page.getByLabel('颜色设置').click();
 await page.getByRole('button',{name:'线性渐变',exact:true}).click();
 await page.getByLabel('HEX',{exact:true}).fill('#ff0000');
 const preview=await page.locator('dialog img[alt="钥匙"]').getAttribute('src');
 assert.match(decodeURIComponent(preview),/<linearGradient/);assert.match(decodeURIComponent(preview),/#ff0000/);
 await page.getByLabel('颜色设置').click();
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'下载',exact:true}).click();const download=await downloading;assert.match(download.suggestedFilename(),/bold-128.svg$/);
 assert.match(readFileSync(await download.path(),'utf8'),/<linearGradient/);
 for(const format of ['png','webp']){
   await page.getByLabel('下载格式').selectOption(format);
   const pending=page.waitForEvent('download');await page.getByRole('button',{name:'下载',exact:true}).click();const exported=await pending;
   const bytes=readFileSync(await exported.path());
   if(format==='png'){assert.equal(bytes.readUInt32BE(16),128);assert.equal(bytes.readUInt32BE(20),128)}
   else{assert.equal(bytes.toString('ascii',8,12),'WEBP')}
 }
 await page.getByRole('button',{name:'收藏图标',exact:true}).click();
 await page.getByRole('button',{name:'取消收藏',exact:true}).waitFor();
 assert.equal(favorites.size,1);
 failMutation=true;
 await page.getByRole('button',{name:'取消收藏',exact:true}).click();
 await page.getByText('收藏更新失败，请重试',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'取消收藏',exact:true}).getAttribute('aria-pressed'),'true');
 failMutation=false;
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.getByRole('searchbox').inputValue(),'钥匙');
 await page.getByRole('button',{name:'打开收藏夹',exact:true}).click();
 await page.getByRole('button',{name:'选择 钥匙 bold',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'选择 钥匙 bold',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('dialog[open]').count(),1);
 await page.screenshot({path:'outputs/library-ui/favorites-desktop.png'});
 const zipped=page.waitForEvent('download');await page.getByRole('button',{name:'下载所选 (1)',exact:true}).click();
 assert.match((await zipped).suggestedFilename(),/favorites.zip$/);
 await page.getByRole('button',{name:'关闭收藏夹',exact:true}).click();
 await page.getByRole('searchbox').fill('');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'钥匙 · linear',exact:true}).click();
 await page.locator('dialog img[alt="钥匙"]').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'outputs/library-ui/detail-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: search, detail, gradient, SVG/PNG/WebP downloads, favorites add/failure retention, selection keeps drawer open, ZIP download, Escape, mobile. Component harness with mock favorites API, not database acceptance.');
}finally{await browser.close();server.close();}
