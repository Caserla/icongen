"use client";
/* eslint-disable @next/next/no-img-element -- self-contained SVG preview and local vector assets */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '@/components/i18n/theme-switch';
import { useSearchParams } from 'next/navigation';
import { useLocale } from '@/components/i18n/locale-provider';
import { Toast } from '@/components/ui/toast';
import { IconPreviewGrid } from '@/features/generation/components/icon-preview-grid';
import { LibraryColorPicker } from "./library-color-picker";
import { catalog, styles, filterCatalog, defaultAppearance, renderSvg, svgDataUrl, exportBlob, saveBlob, validateVariant, type Appearance, type Design, type LibraryStyle, type Variant, type FileFormat } from './core';
import css from './library.module.css';
import { useLibraryFavorites, LibraryFavoritesPanel, FavoriteStar, type LibraryFavorites } from './library-favorites';
import { assetId } from './favorite-model';
import { codeTargets, exportCode, type CodeTarget } from './code-export';
import { SelectionPopover, useSelectionPopover } from './selection-popover';

const categories: Record<string, [string,string]> = {essential:['基础','Essential'],files:['文件','Files'],emoji:['表情','Emoji'],time:['时间','Time'],weather:['天气','Weather'],food:['食物','Food'],energy:['能源','Energy'],kitchen:['厨房','Kitchen']};
const cache = new Map<string, Record<LibraryStyle, Variant>>();
Object.assign(categories,Object.fromEntries(Object.entries({home:'家居',clothes:'服装',stationery:'文具',design:'设计','school-learning':'学习',money:'财务',shop:'购物',notifications:'通知',animals:'动物',baby:'母婴',building:'建筑',business:'商务',call:'通话',car:'汽车','car-service':'汽车服务',casino:'棋牌',christmas:'圣诞',clothes2:'服饰配件',coffe:'咖啡',furniture:'家具',game:'游戏',nature:'自然',pet:'宠物',travel:'旅行',delivery:'配送','design-tools':'设计工具',device:'智能设备',devices:'电子设备',fitness:'健身',food2:'餐饮',halloween:'万圣节',network:'网络',ecology:'生态',health:'健康',landmarks:'地标',military:'军事',mobile:'移动设备',tools:'工具',video:'视频','video-audio-image':'影音图像',space:'太空',space2:'航天',sports:'运动',sports2:'球拍运动',telephone:'电话',search:'搜索',wedding:'婚礼',vr:'虚拟现实'}).map(([key,value])=>[key,[value,key.replaceAll('-',' ')]])));
Object.assign(categories,{archive:['档案','Archive'],beauty:['美妆','Beauty'],booking:['预约','Booking'],'computers-devices-electronics':['电脑设备','Devices'],email:['邮件','Email'],medical:['医疗','Medical'],security:['安全','Security'],location:['位置','Location']});

export function LibraryBrowser() {
  const [mounted,setMounted]=useState(false);
  useEffect(()=>{setMounted(true);},[]);
  // The interactive workbench reads URL state, browser preferences and cached
  // variants. Keep its server and initial client markup identical.
  if(!mounted)return <section className={css.library} aria-busy="true"><div className={css.libraryLoading}/></section>;
  return <LibraryWorkbench/>;
}

function LibraryWorkbench() {
  const { locale } = useLocale();
  const zh = locale === 'zh';
  const favorites = useLibraryFavorites();
  const query = useSearchParams();
  const q = query.get('q') ?? '';
  const category = query.get('category') ?? '';
  const categoryRail = useRef<HTMLElement>(null);
  const [categoryHighlight,setCategoryHighlight] = useState<{x:number;y:number;width:number;height:number}|null>(null);
  useLayoutEffect(()=>{
    const rail=categoryRail.current;
    if(!rail)return;
    const measure=()=>{
      const active=rail.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if(!active){setCategoryHighlight(null);return;}
      setCategoryHighlight({x:active.offsetLeft,y:active.offsetTop,width:active.offsetWidth,height:active.offsetHeight});
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(rail);
    rail.querySelectorAll('button').forEach(button=>observer.observe(button));
    return()=>observer.disconnect();
  },[category,locale]);
  const style = styles.includes(query.get('style') as LibraryStyle) ? query.get('style') as LibraryStyle : 'linear';
  const styleRail=useRef<HTMLDivElement>(null);
  const toolbarRef=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const toolbar=toolbarRef.current;
    if(!toolbar)return;
    const measure=()=>toolbar.parentElement?.style.setProperty('--toolbar-height',`${toolbar.getBoundingClientRect().height}px`);
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(toolbar);
    return()=>observer.disconnect();
  },[]);
  const [styleHighlight,setStyleHighlight]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  useLayoutEffect(()=>{
    const rail=styleRail.current;
    if(!rail)return;
    const measure=()=>{
      const active=rail.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if(active)setStyleHighlight({x:active.offsetLeft,y:active.offsetTop,width:active.offsetWidth,height:active.offsetHeight});
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(rail);
    rail.querySelectorAll('button').forEach(button=>observer.observe(button));
    return()=>observer.disconnect();
  },[style,locale]);
  const selected = catalog.find(item => item.id === query.get('icon'));
  const [message, setMessage] = useState('');
  const [noticeKey, setNoticeKey] = useState(0);
  const notify = (text: string) => { setMessage(text); setNoticeKey(n => n+1); };
  const update = (key: string, value: string, push = false) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key,value); else params.delete(key);
    window.history[push ? 'pushState' : 'replaceState'](null, '', `/library${params.size ? '?' + params : ''}`);
  };
  const items = filterCatalog(q, category);
  const gridRef=useRef<HTMLDivElement>(null);
  const loadMoreRef=useRef<HTMLDivElement>(null);
  const filterKey=JSON.stringify([q,category,style]);
  const [batch,setBatch]=useState({key:filterKey,count:48});
  const visibleCount=batch.key===filterKey?batch.count:48;
  useLayoutEffect(()=>{gridRef.current?.scrollTo({top:0});},[filterKey]);
  useEffect(()=>{
    const grid=gridRef.current,marker=loadMoreRef.current;
    if(!grid||!marker||visibleCount>=items.length)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting))setBatch(previous=>({key:filterKey,count:Math.min(items.length,(previous.key===filterKey?previous.count:48)+48)}));
    },{root:grid,rootMargin:'0px 0px 240px 0px'});
    observer.observe(marker);
    return()=>observer.disconnect();
  },[filterKey,visibleCount,items.length]);
  return <section className={css.library} data-detail-open={Boolean(selected)} aria-label={zh ? '素材库' : 'Library'}>
    <aside ref={categoryRail} className={css.sidebar}>
      {categoryHighlight&&<span aria-hidden="true" className={css.categoryHighlight} style={{transform:`translate(${categoryHighlight.x}px, ${categoryHighlight.y}px)`,width:categoryHighlight.width,height:categoryHighlight.height}}/>}
      <h2>{zh ? '分类' : 'Categories'}</h2>
      <button aria-pressed={!category} onClick={() => update('category','')}>{zh ? '全部图标' : 'All icons'}<span>{catalog.length}</span></button>
      {Object.entries(categories).map(([id,names]) => <button key={id} aria-pressed={category === id} onClick={() => update('category',id)}>{names[zh ? 0 : 1]}<span>{catalog.filter(item=>item.category===id).length}</span></button>)}
    </aside>
    <div className={css.main}>
      <header ref={toolbarRef} className={css.toolbar}>
        <div className={css.search}>
          <svg className={css.searchGlyph} aria-hidden="true" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="18" cy="14" r="11"/><path d="m10 22-7 7"/></svg>
          <input aria-label={zh ? '搜索图标' : 'Search icons'} placeholder={zh ? '搜索图标名称…' : 'Search icons…'} value={q} onChange={e=>update('q',e.target.value)} type="search"/>
          {q&&<button type="button" className={css.searchClear} aria-label={zh?'清除搜索':'Clear search'} onClick={event=>{update('q','');event.currentTarget.parentElement?.querySelector('input')?.focus();}}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m5 5 14 14M19 5 5 19"/></svg></button>}
        </div>
        <span className={css.muted}>{items.length} {zh ? '个设计' : 'designs'}</span>
      <div ref={styleRail} className={`${css.tabs} ${css.styleRail}`} aria-label={zh ? '图标风格' : 'Icon styles'}>
        {styleHighlight&&<span aria-hidden="true" className={css.styleHighlight} style={{transform:`translate(${styleHighlight.x}px, ${styleHighlight.y}px)`,width:styleHighlight.width,height:styleHighlight.height}}/>}
        {styles.map(item => <button key={item} aria-pressed={item===style} onClick={()=>update('style',item)}>{item}</button>)}
      </div>
      </header>
      {items.length ? <div ref={gridRef} className={css.grid} role="region" aria-label={zh?'图标列表':'Icon list'} tabIndex={0}>{items.slice(0,visibleCount).map(item => {
        const id=assetId(item.id,style,item.version);
        const saved=favorites.ids.includes(id);
        return <div className={`${css.cell} ${css.browseCell}`} data-favorited={saved} key={item.id}>
        <button className={css.cellOpen} onClick={()=>update('icon',item.id,true)} aria-label={`${zh ? item.nameZh : item.nameEn} · ${style}`}>
        <img src={`/library/samples/${item.id}/${style}.svg`} width="36" height="36" loading="lazy" alt=""/>
        </button>
        <span className={css.cellName}>{zh ? item.nameZh : item.nameEn}</span>
        <i className={css.cornerDots} aria-hidden="true"/>
        <button className={css.cellFavorite} aria-label={saved?(zh?'取消收藏':'Remove favorite'):(zh?'加入收藏':'Add to favorites')} title={saved?(zh?'取消收藏':'Remove favorite'):(zh?'加入收藏':'Add to favorites')} aria-pressed={saved} disabled={favorites.busy.includes(id)} onClick={()=>{if(!favorites.ready){notify(zh?'收藏暂不可用，请打开收藏夹重试':'Favorites unavailable. Open favorites to retry.');return;}void favorites.toggle(id).catch(()=>notify(zh?'收藏更新失败，请重试':'Favorite update failed. Try again.'));}}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={saved?'M6 12h12':'M12 4v16M4 12h16'}/></svg>
        </button>
      </div>;})}{visibleCount<items.length&&<div ref={loadMoreRef} className={css.loadMoreMarker} aria-hidden="true"/>}</div> : <div className={css.empty}>{zh ? '没有匹配的图标，请更换搜索条件。' : 'No matching icons. Try another search.'}</div>}
    </div>
    <LibraryFavoritesPanel favorites={favorites} zh={zh} notify={notify}/>
    {selected && <Detail design={selected} items={items} navigate={(id,currentStyle)=>{const params=new URLSearchParams(window.location.search);params.set('icon',id);params.set('style',currentStyle);window.history.replaceState(null,'',`/library?${params}`);}} initialStyle={style} zh={zh} close={()=>update('icon','')} notify={notify} favorites={favorites}/>}
    {message && <Toast key={noticeKey} message={message} variant="warning"/>}
  </section>;
}

function Detail({design, items, navigate, initialStyle, zh, close, notify,favorites}: {design:Design;items:Design[];navigate:(id:string,style:LibraryStyle)=>void;initialStyle:LibraryStyle;zh:boolean;close:()=>void;notify:(text:string)=>void;favorites:LibraryFavorites}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [style,setStyle] = useState(initialStyle);
  const [variants,setVariants] = useState<Record<LibraryStyle,Variant> | undefined>(cache.get(design.id));
  const [error,setError] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const theme = useTheme();
  const [appearanceState,setAppearance] = useState<Appearance>(defaultAppearance);
  const [customColor,setCustomColor] = useState(false);
  const appearance: Appearance = customColor ? appearanceState : {
    ...appearanceState,
    color: theme === 'light' ? '#000000' : '#ffffff',
  };
  const [format,setFormat] = useState<FileFormat>('svg');
  const [busy,setBusy] = useState(false);
  const [codeTarget,setCodeTarget] = useState<CodeTarget>('SVG');
  const index = items.findIndex(item=>item.id===design.id);
  const previousIcon = index>0 ? items[index-1] : undefined;
  const nextIcon = index>=0 ? items[index+1] : undefined;
  useEffect(()=>{
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const overflow = document.body.style.overflow;
    node?.showModal(); document.body.style.overflow='hidden';
    return ()=>{node?.close(); document.body.style.overflow=overflow; previous?.focus(); };
  },[]);
  useEffect(()=>{
    setError(false);
    setVariants(cache.get(design.id));
    if (cache.has(design.id)) return;
    const controller = new AbortController();
    fetch(design.url,{signal:controller.signal}).then(async r=>{
      if (!r.ok) throw Error('Load failed');
      const data = await r.json();
      for (const key of styles) validateVariant(data[key]);
      cache.set(design.id,data); setVariants(data); setError(false);
    }).catch(()=>{if (!controller.signal.aborted) setError(true);});
    return ()=>controller.abort();
  },[design.id,design.url,attempt]);
  const variant = variants?.[style];
  const strokeEnabled = Boolean(variant) && (['broken','linear','twotone'] as LibraryStyle[]).includes(style);
  const svg = variant ? renderSvg(variant,appearance) : '';
  const code = exportCode(svg,codeTarget);
  const change = <K extends keyof Appearance>(key:K,value:Appearance[K])=>setAppearance(previous=>({...previous,[key]:value}));
  const download = async()=>{
    if (!svg || busy) return;
    setBusy(true);
    const snapshot = {svg,format,size:appearance.size,name:`${design.id}-${style}-${appearance.size}`};
    try {saveBlob(await exportBlob(snapshot.svg,snapshot.format,snapshot.size),`${snapshot.name}.${snapshot.format}`);}
    catch {notify(zh?'下载失败，请重试。':'Download failed. Try again.');}
    finally {setBusy(false);}
  };
  return <dialog ref={dialog} className={`${css.dialog} ${css.iconDetail}`} aria-label={zh ? `${design.nameZh}详情` : `${design.nameEn} details`} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget) {const r=event.currentTarget.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}}>
    <button className={css.close} onClick={close} aria-label={zh?'关闭详情':'Close details'}>×</button>
    {[{item:previousIcon,direction:'previous'},{item:nextIcon,direction:'next'}].map(({item,direction})=><button key={direction} className={`${css.neighbor} ${direction==='previous'?css.previous:css.next}`} disabled={!item} aria-label={zh?(direction==='previous'?'上一个图标':'下一个图标'):(direction==='previous'?'Previous icon':'Next icon')} onClick={()=>{if(item)navigate(item.id,style);}}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={direction==='previous'?'m15 5-7 7 7 7':'m9 5 7 7-7 7'}/></svg>{item&&<img src={`/library/samples/${item.id}/${style}.svg`} width="40" height="40" alt=""/>}</button>)}
    <div className={css.detailContent}>
    <div className={css.detailLayout}>
    <div className={css.codeTabs} aria-label={zh?'代码格式':'Code format'}><span aria-hidden="true" className={css.codeTabIndicator} style={{left:`calc(${codeTargets.indexOf(codeTarget)*100/6}% + ${6-codeTargets.indexOf(codeTarget)*8/6}px)`}}/>{codeTargets.map(target=><button key={target} aria-pressed={target===codeTarget} onClick={()=>setCodeTarget(target)}>{target}</button>)}</div>
    <div className={css.variants} aria-label={zh?'切换风格':'Change style'}>{styles.map(key=><button key={key} aria-label={key} aria-pressed={style===key} onClick={()=>setStyle(key)}><img src={`/library/samples/${design.id}/${key}.svg`} width="28" height="28" alt=""/><span>{key}</span></button>)}</div>
    <div className={css.previewPanel}>
      <div className={css.metadata}><span>{zh?'名称':'Name'}: <strong>{zh?design.nameZh:design.nameEn}</strong></span><span>{style}</span></div>
      <div className={css.stage}>
        <IconPreviewGrid className={css.guides}>
          {svg ? <img className={css.previewIcon} src={svgDataUrl(svg)} alt={zh?design.nameZh:design.nameEn}/> : error ? <button onClick={()=>{setError(false);setAttempt(n=>n+1);}}>{zh?'加载失败，点击重试':'Load failed. Retry'}</button> : <span className={css.skeleton} aria-label={zh?'加载中':'Loading'}/>}
        </IconPreviewGrid>
      </div>
    </div>
    <section className={css.liveCode} aria-label={zh?'实时代码':'Live code'}>
      <textarea aria-label={zh?'实时代码内容':'Live code content'} readOnly spellCheck={false} wrap="soft" value={code}/>
      <button disabled={!svg} onClick={()=>{void navigator.clipboard.writeText(code).then(()=>notify(zh?'代码已复制':'Code copied')).catch(()=>notify(zh?'复制失败，请手动复制':'Copy failed. Select the code manually.'));}}>{zh?'复制代码':'Copy code'}</button>
    </section>
    </div>
    <div className={css.controls}>
      <LibraryColorPicker value={appearance} onChange={value=>{setCustomColor(true);setAppearance(value);}} zh={zh}/>
      <SizePicker value={appearance.size} onChange={value=>change('size',value)} zh={zh}/>
      <label className={css.strokeControl} data-disabled={!strokeEnabled}><span aria-hidden="true">0.5</span><input aria-label={zh?'线条粗细':'Stroke width'} disabled={!strokeEnabled} type="range" min="0.5" max="2.5" step="0.1" value={appearance.strokeWidth??1.5} onChange={event=>change('strokeWidth',Number(event.target.value))} style={{background:`linear-gradient(to right,${strokeEnabled?'#eee':'#303030'} ${((appearance.strokeWidth??1.5)-.5)/2*100}%,${strokeEnabled?'#242424':'#111'} 0)`}}/><span aria-hidden="true">2.5</span></label>
      <FavoriteStar id={assetId(design.id,style,design.version)} favorites={favorites} zh={zh} notify={notify}/>
      <DownloadControl format={format} setFormat={setFormat} disabled={!svg||busy} busy={busy} zh={zh} download={()=>void download()}/>
    </div>
    </div>
  </dialog>;
}

function DownloadControl({format,setFormat,disabled,busy,zh,download}:{format:FileFormat;setFormat:(value:FileFormat)=>void;disabled:boolean;busy:boolean;zh:boolean;download:()=>void}) {
  const {open,setOpen,root,trigger,close,rootProps}=useSelectionPopover();
  const [above,setAbove]=useState(false);
  return <div className={css.downloadGroup} ref={root} {...rootProps}>
    <button type="button" className={css.downloadAction} disabled={disabled} onClick={download}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/></svg>{busy?(zh?'导出中…':'Exporting…'):(zh?'下载':'Download')}</button>
    <button type="button" ref={trigger} className={css.formatTrigger} aria-label={zh?'下载格式':'Download format'} aria-expanded={open} disabled={busy} onClick={()=>{setAbove(window.innerHeight-(root.current?.getBoundingClientRect().bottom??0)<174);setOpen(previous=>!previous);}}><span>.{format}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}}><path d="m6 9 6 6 6-6"/></svg></button>
    {open&&<SelectionPopover label={zh?'选择下载格式':'Choose download format'} value={format} options={(['svg','png','webp'] as const).map(value=>({value,label:`.${value}`}))} above={above} align="right" onSelect={value=>{setFormat(value);close();}}/>}
  </div>;
}

function SizePicker({value,onChange,zh}:{value:number;onChange:(value:number)=>void;zh:boolean}) {
  const {open,setOpen,root,trigger,close,rootProps}=useSelectionPopover();
  const [draft,setDraft]=useState('');
  const choose=(size:number)=>{onChange(size);setDraft('');close();};
  const valid=/^\d+$/.test(draft)&&Number(draft)>=24&&Number(draft)<=128;
  return <div ref={root} className={css.sizePicker} {...rootProps}>
    <button ref={trigger} type="button" className={css.sizeTrigger} aria-label={zh?'输出尺寸':'Output size'} aria-expanded={open} onClick={()=>setOpen(previous=>!previous)}><span>{value}px</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}}><path d="m6 9 6 6 6-6"/></svg></button>
    {open&&<SelectionPopover label={zh?'选择尺寸':'Choose size'} value={value} options={[24,32,48,64,128].map(value=>({value,label:value,suffix:'px'}))} onSelect={choose}>
      <div className={css.sizeDivider} aria-hidden="true"><span/></div>
      <form className={css.customSize} onSubmit={event=>{event.preventDefault();if(valid)choose(Number(draft));}}>
        <input aria-label={zh?'自定义尺寸（24至128像素）':'Custom size (24 to 128 pixels)'} inputMode="numeric" pattern="[0-9]*" maxLength={3} placeholder={zh?'尺寸…':'Size…'} value={draft} onChange={event=>setDraft(event.target.value)} title={zh?'支持24–128像素':'24–128 pixels'}/>
        <button type="submit" disabled={!valid} aria-label={zh?'确认尺寸':'Apply size'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>
      </form>
    </SelectionPopover>}
  </div>;
}
