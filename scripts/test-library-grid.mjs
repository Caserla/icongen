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
const server=createServer((req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(js)}if(path.startsWith('/library/samples/')){try{const file=resolve('apps/web/public'+decodeURIComponent(path));if(!file.startsWith(resolve('apps/web/public/library/samples')+'/'))throw Error();res.setHeader('Content-Type',file.endsWith('.svg')?'image/svg+xml':'application/json');return res.end(readFileSync(file))}catch{res.statusCode=404;return res.end()}}res.setHeader('Content-Type','text/html');res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#101012;font-family:Arial,sans-serif}button,input,select{font:inherit}${css}${guides}</style></head><body><div class="studio-shell"><header style="height:64px">Header</header><div><main class="studio-main"><div id="root" style="display:contents"></div></main></div></div><script src="/app.js"></script></body></html>`)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.E2E_BROWSER_CHANNEL ?? 'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:900}});

try {await page.route('**/api/library/favorites',r=>r.fulfill({json:{items:[]}}));await page.goto('http://127.0.0.1:'+server.address().port+'/library');await page.locator('[data-favorited]').first().waitFor(); const cells=page.locator('[data-favorited]'); await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))); const before=await cells.first().boundingBox();await cells.first().hover();const after=await cells.first().boundingBox();assert.deepEqual(after,before);const boxes=await cells.evaluateAll(es=>es.slice(0,20).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));console.log(boxes);assert.ok(boxes.every(b=>b.w>80&&Math.abs(b.w-b.h)<1));console.log('PASS square cells and stable hover');}finally{await browser.close();server.close();}
