"use client";
/* eslint-disable @next/next/no-img-element -- local SVG assets */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findAsset } from './favorite-model';
import css from './library.module.css';

export function useLibraryFavorites(autoLoad = true) {
  const [ids,setIds]=useState<string[]>([]);
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState(false);
  const [busy,setBusy]=useState<string[]>([]);
  const pending=useRef(new Set<string>());
  const epoch=useRef(0);
  const load=useCallback(async()=>{
    if(pending.current.size) return;
    const version=++epoch.current;
    try{
      const response=await fetch('/api/library/favorites',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Unavailable');
      const data=await response.json() as {items:{asset_id:string}[]};
      if(version!==epoch.current)return;
      setIds(data.items.map(item=>item.asset_id));setFailed(false);setReady(true);
    }catch{if(version===epoch.current){setFailed(true);setReady(false);}}
  },[]);
  useEffect(()=>{if(!autoLoad)return;const timer=setTimeout(()=>void load(),0);window.addEventListener('focus',load);return()=>{clearTimeout(timer);window.removeEventListener('focus',load);};},[autoLoad,load]);
  const toggle=async(id:string)=>{
    if(!ready||pending.current.has(id))return;
    pending.current.add(id);epoch.current++;setBusy([...pending.current]);
    const remove=ids.includes(id);
    try{
      const response=await fetch('/api/library/favorites',{method:remove?'DELETE':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({assetId:id}),signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Favorite update failed');
      setIds(previous=>remove?previous.filter(value=>value!==id):[id,...previous.filter(value=>value!==id)]);
    }finally{pending.current.delete(id);setBusy([...pending.current]);}
  };
  return {ids,ready,failed,busy,load,toggle};
}
export type LibraryFavorites = ReturnType<typeof useLibraryFavorites>;

function StarGlyph({filled=false}:{filled?:boolean}){return <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="m12 3 2.8 5.7 6.3.9-4.55 4.44 1.07 6.27L12 17.35l-5.62 2.96 1.07-6.27L2.9 9.6l6.3-.9Z"/></svg>;}

export function FavoriteStar({id,favorites,zh,notify}:{id:string;favorites:LibraryFavorites;zh:boolean;notify:(text:string)=>void}){
  const selected=favorites.ids.includes(id);
  return <button className={css.favoriteStar} aria-label={selected?(zh?'取消收藏':'Remove favorite'):(zh?'收藏图标':'Favorite icon')} aria-pressed={selected} disabled={!favorites.ready||favorites.busy.includes(id)} title={!favorites.ready?(zh?'收藏未就绪，请打开收藏夹重试':'Favorites unavailable; open the panel to retry'):undefined} onClick={()=>{void favorites.toggle(id).catch(()=>notify(zh?'收藏更新失败，请重试':'Favorite update failed. Try again.'));}}><StarGlyph filled={selected}/></button>;
}

export function LibraryFavoritesPanel({favorites,zh,notify,inline=false}:{favorites:LibraryFavorites;zh:boolean;notify:(text:string)=>void;inline?:boolean}){
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{setMounted(true);},[]);
  const dialog=useRef<HTMLElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  const [closing,setClosing]=useState(false);
  const close=useCallback(()=>{setClosing(true);},[]);
  useEffect(()=>{if(!closing)return;const timer=setTimeout(()=>{setOpen(false);setClosing(false);},220);return()=>clearTimeout(timer);},[closing]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(document.querySelector('dialog[open]'))return;if(event.target instanceof Node&&!dialog.current?.contains(event.target)&&!trigger.current?.contains(event.target))close();};
    const escape=(event:KeyboardEvent)=>{if(document.querySelector('dialog[open]'))return;if(event.key==='Escape'){close();trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open,close]);
  const content=<>
      <header className={css.drawerHeader}><h2>{zh?'收藏夹':'Favorites'} · {favorites.ids.length}</h2></header>
      {favorites.failed?<button onClick={()=>void favorites.load()}>{zh?'收藏加载失败，点击重试':'Favorites unavailable. Retry'}</button>:!favorites.ready?<p>{zh?'加载中…':'Loading…'}</p>:favorites.ids.length===0?<p>{zh?'还没有收藏图标':'No favorite icons yet'}</p>:<>
        <div className={css.favoriteGrid}>{favorites.ids.map(id=>{const asset=findAsset(id);return <div className={css.favoriteItem} key={id}><button type="button" className={css.favoriteSelect} disabled={!asset} aria-label={asset?(zh?'打开详情：':'Open details: ')+(zh?asset.design.nameZh:asset.design.nameEn)+' · '+asset.style:id} onClick={()=>{if(!asset)return;const params=new URLSearchParams(window.location.search);params.set('icon',asset.design.id);params.set('style',asset.style);window.history.pushState(null,'',`/library?${params}`);}}>
          {asset?<img src={`/library/samples/${asset.design.id}/${asset.style}.svg`} alt="" width="40" height="40"/>:<span>{zh?'素材已退役':'Unavailable'}</span>}
          <span>{asset?(zh?asset.design.nameZh:asset.design.nameEn):id}</span><small>{asset?.style}</small>
        </button><button className={css.favoriteRemove} aria-label={`${zh?'取消收藏':'Remove favorite'} ${asset?(zh?asset.design.nameZh:asset.design.nameEn):id} ${asset?.style??''}`} disabled={favorites.busy.includes(id)} onClick={()=>void favorites.toggle(id).catch(()=>notify(zh?'移除失败，请重试':'Removal failed. Try again.'))}><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 12h12"/></svg></button></div>;})}</div>
      </>}
  </>;
  if(inline)return <aside className={css.collectionRail} aria-label={zh?'素材收藏夹':'Library favorites'}>{content}</aside>;
  return <>
    {mounted&&createPortal(<><button ref={trigger} className="favorites-float focus-ring" aria-label={zh?'打开收藏夹':'Open favorites'} aria-expanded={open} onClick={()=>{if(open){close();return;}setClosing(false);setOpen(true);void favorites.load();}}><StarGlyph/><span>{zh?'打开收藏夹':'Open favorites'}</span></button>
    {open&&<><div aria-hidden="true" className={css.drawerBackdrop} data-closing={closing}/><aside ref={dialog} role="dialog" aria-modal="false" className={`favorites-drawer ${css.libraryDrawer} ${closing?'is-closing':''}`} aria-label={zh?'素材收藏夹':'Library favorites'}>
      {content}
    </aside></>}</>,document.body)}
  </>;
}
