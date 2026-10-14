"use client";
import {useEffect,useState} from "react";
import {useLocale} from "@/components/i18n/locale-provider";
import {Toast} from "@/components/ui/toast";
export function AdminDashboard(){
 const {locale}=useLocale();const zh=locale==='zh';
 const [data,setData]=useState<Record<string,number>|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();void fetch('/api/admin/overview',{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();setData(await r.json());}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[]);
 return <main className="admin-studio p-6"><h1 className="text-3xl font-bold">{zh?'本地运行概览':'Local overview'}</h1><p className="mt-3 text-muted">{zh?'账户、项目与 SVG 生成数据，无充值或收费功能。':'Accounts, projects and SVG results. No billing.'}</p>{error?<Toast message={zh?'概览加载失败':'Overview unavailable'} variant="error"/>:null}<section className="mt-6 grid gap-4 sm:grid-cols-3">{[['users',zh?'用户':'Users'],['projects',zh?'项目':'Projects'],['icons',zh?'SVG 主体':'SVG subjects']].map(([key,label])=><article key={key} className="studio-panel p-6"><h2>{label}</h2><strong className="text-3xl">{data?.[key]??'…'}</strong></article>)}</section></main>;
}
