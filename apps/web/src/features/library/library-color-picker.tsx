"use client";
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex } from './color-math';
import type { Appearance } from './core';
import { useSelectionPopover } from './selection-popover';
import css from './library.module.css';

export function LibraryColorPicker({value,onChange,zh}:{value:Appearance;onChange:(value:Appearance)=>void;zh:boolean}) {
  const {open,setOpen,root,trigger,rootProps}=useSelectionPopover();
  return <div ref={root} className={css.libraryColorRoot} {...rootProps}>
    <button type="button" ref={trigger} className={css.libraryColorTrigger} aria-label={zh?'颜色设置':'Color settings'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span style={{background:value.mode==='solid'?value.color:`linear-gradient(90deg,${value.color},${value.endColor})`}}/><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}}><path d="m6 9 6 6 6-6"/></svg></button>
    {open&&<ColorPanel value={value} onChange={onChange} zh={zh}/>}
  </div>;
}
function ColorPanel({value,onChange,zh}:{value:Appearance;onChange:(value:Appearance)=>void;zh:boolean}) {
  const panel=useRef<HTMLDivElement>(null);
  const [top,setTop]=useState<number>();
  useLayoutEffect(()=>{
    const node=panel.current;
    if(!node)return;
    const anchor=node.parentElement!.getBoundingClientRect();
    // Reserve the taller gradient state so changing modes never moves the top.
    setTop(Math.max(8,anchor.top-410)-anchor.top);
  },[]);
  const [stop,setStop]=useState<0|1>(0);
  const [format,setFormat]=useState<'hex'|'rgba'>('hex');
  const [hue,setHue]=useState(hexToHsv(value.color).h);
  const gradient=value.mode!=='solid';
  const end=gradient&&stop===1;
  const color=end?value.endColor:value.color;
  const hsv=hexToHsv(color);
  const alpha=(end?value.endAlpha:value.alpha)??1;
  const rgb=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
  const changeColor=(color:string)=>onChange({...value,[end?'endColor':'color']:color});
  const selectStop=(next:0|1)=>{setStop(next);setHue(hexToHsv(next?value.endColor:value.color).h);};
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const r=event.currentTarget.getBoundingClientRect();
    const s=Math.max(0,Math.min(1,(event.clientX-r.left)/r.width));
    const v=1-Math.max(0,Math.min(1,(event.clientY-r.top)/r.height));
    changeColor(hsvToHex(hue,s,v));
  };
  return <div ref={panel} className={css.libraryColorPanel} style={top===undefined?undefined:{top,bottom:'auto'}} role="group" aria-label={zh?'拾色器':'Color picker'}>
    <div className={`${css.paintTabs} ${css.paintModeTabs}`}><span className={css.paintModeIndicator} aria-hidden="true" style={{transform:gradient?'translateX(100%)':'translateX(0)'}}/>{[false,true].map(g=><button type="button" key={String(g)} aria-pressed={gradient===g} onClick={()=>{onChange({...value,mode:g?'linear':'solid'});if(!g)selectStop(0);}}>{g?(zh?'渐变':'Gradient'):(zh?'纯色':'Pure')}</button>)}</div>
    {gradient&&<><div className={css.gradientOptions}><div className={`${css.paintTabs} ${css.paintModeTabs}`}><span className={css.paintModeIndicator} aria-hidden="true" style={{transform:value.mode==='radial'?'translateX(100%)':'translateX(0)'}}/>{(['linear','radial'] as const).map(mode=><button type="button" key={mode} aria-pressed={value.mode===mode} onClick={()=>onChange({...value,mode})}>{zh?(mode==='linear'?'线性':'径向'):mode}</button>)}</div>{value.mode==='linear'&&<AngleDial value={value.angle} onChange={angle=>onChange({...value,angle})} zh={zh}/>}</div><GradientStops value={value} onChange={onChange} selected={stop} select={selectStop} zh={zh}/></>}
    <div className={css.saturation} role="slider" tabIndex={0} aria-label={zh?'饱和度与亮度':'Saturation and brightness'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s*100)} aria-valuetext={`${Math.round(hsv.s*100)}%, ${Math.round(hsv.v*100)}%`} style={{backgroundColor:`hsl(${hue} 100% 50%)`}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);move(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))move(e);}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();changeColor(hsvToHex(hue,Math.max(0,Math.min(1,hsv.s+(e.key==='ArrowRight'?.01:e.key==='ArrowLeft'?-.01:0))),Math.max(0,Math.min(1,hsv.v+(e.key==='ArrowUp'?.01:e.key==='ArrowDown'?-.01:0)))));}}><span style={{left:`${hsv.s*100}%`,top:`${(1-hsv.v)*100}%`}}/></div>
    <input className={css.hueSlider} type="range" min="0" max="359" value={hue} aria-label={zh?'色相':'Hue'} onChange={e=>{const h=Number(e.target.value);setHue(h);changeColor(hsvToHex(h,hsv.s,hsv.v));}}/>
    <div className={css.colorValues}><span className={css.colorSample} style={{background:color,opacity:alpha}}/>{format==='hex'?<HexInput key={`${end}`} color={color} change={c=>{changeColor(c);setHue(hexToHsv(c).h);}}/>:<div className={css.rgbaFields}>{rgb.map((n,i)=><input key={i} aria-label={['R','G','B'][i]} type="number" min="0" max="255" value={n} onChange={e=>{const channels=[...rgb];channels[i]=Math.max(0,Math.min(255,Number(e.target.value)));const c='#'+channels.map(v=>v.toString(16).padStart(2,'0')).join('');changeColor(c);setHue(hexToHsv(c).h);}}/>)}<input aria-label={zh?'透明度':'Alpha'} type="number" min="0" max="1" step="0.01" value={alpha} onChange={e=>onChange({...value,[end?'endAlpha':'alpha']:Math.max(0,Math.min(1,Number(e.target.value)))})}/></div>}<button type="button" className={css.colorFormat} aria-label={zh?'切换颜色格式':'Switch color format'} onClick={()=>setFormat(format==='hex'?'rgba':'hex')}><span>▴</span>{format}<span>▾</span></button></div>
  </div>;
}
function HexInput({color,change}:{color:string;change:(c:string)=>void}) {
  const [draft,setDraft]=useState<string|null>(null);
  return <input aria-label="HEX" value={draft??color.slice(1)} maxLength={7} onChange={e=>{setDraft(e.target.value);const hex=e.target.value.replace(/^#/,'');if(/^[\da-f]{6}$/i.test(hex))change('#'+hex);}} onBlur={()=>setDraft(null)}/>;
}

function GradientStops({value,onChange,selected,select,zh}:{value:Appearance;onChange:(v:Appearance)=>void;selected:0|1;select:(i:0|1)=>void;zh:boolean}) {
  const positions=[value.startOffset??0,value.endOffset??100];
  const update=(i:0|1,n:number)=>onChange({...value,[i?'endOffset':'startOffset']:Math.round(Math.max(i?positions[0]:0,Math.min(i?100:positions[1],n)))});
  const drag=(e:PointerEvent<HTMLButtonElement>,i:0|1)=>{const r=e.currentTarget.parentElement!.getBoundingClientRect();update(i,(e.clientX-r.left-10)/(r.width-20)*100);};
  return <div className={css.stopTrack} style={{background:`linear-gradient(to right,${value.color} ${positions[0]}%,${value.endColor} ${positions[1]}%)`}}>{([0,1] as const).map(i=><button type="button" key={i} role="slider" aria-label={zh?(i?'结束色标位置':'起始色标位置'):(i?'End stop position':'Start stop position')} aria-valuemin={i?positions[0]:0} aria-valuemax={i?100:positions[1]} aria-valuenow={positions[i]} data-selected={selected===i} style={{left:`calc(${positions[i]}% + ${10-positions[i]*.2}px)`,background:i?value.endColor:value.color,zIndex:selected===i?2:1}} onClick={()=>select(i)} onPointerDown={e=>{select(i);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))drag(e,i);}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();select(i);update(i,e.key==='Home'?0:e.key==='End'?100:positions[i]+(e.key==='ArrowRight'?1:-1));}}}/>)}</div>;
}

function AngleDial({value,onChange,zh}:{value:number;onChange:(n:number)=>void;zh:boolean}) {
  const {open,setOpen,root,trigger,rootProps}=useSelectionPopover();
  const drag=(e:PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect();const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;if(Math.hypot(x,y)<3)return;onChange(Math.round((Math.atan2(x,-y)*180/Math.PI+360)%360));};
  return <div ref={root} className={css.angleControl} {...rootProps}><button ref={trigger} type="button" className={css.angleReadout} aria-label={zh?'渐变角度':'Gradient angle'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{value}<span>deg</span></button>{open&&<div className={css.anglePopover}><div className={css.angleDial} role="slider" tabIndex={0} aria-label={zh?'拖动角度指针':'Angle dial'} aria-valuemin={0} aria-valuemax={359} aria-valuenow={value} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))drag(e);}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();onChange((value+(['ArrowRight','ArrowUp'].includes(e.key)?1:359))%360);}}}><span style={{transform:`rotate(${value}deg)`}}/></div></div>}</div>;
}
