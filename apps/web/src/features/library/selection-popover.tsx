"use client";

import { useEffect, useRef, useState, type ReactNode, type FocusEvent, type KeyboardEvent } from 'react';
import css from './library.module.css';

export function useSelectionPopover() {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const portalRoot=useRef<HTMLDivElement>(null);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)&&!portalRoot.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  return {open,setOpen,root,trigger,portalRoot,close,rootProps:{
    onBlur:(event:FocusEvent<HTMLDivElement>)=>{if(!root.current?.contains(event.relatedTarget)&&!portalRoot.current?.contains(event.relatedTarget))setOpen(false);},
    onKeyDown:(event:KeyboardEvent<HTMLDivElement>)=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();}},
  }};
}

export function SelectionPopover<T extends string|number>({label,value,options,onSelect,above=true,align='left',children,className}:{
  label:string;value:T;options:{value:T;label:ReactNode;suffix?:ReactNode}[];onSelect:(value:T)=>void;above?:boolean;align?:'left'|'right';children?:ReactNode;className?:string;
}) {
  return <div className={`${css.selectionPanel}${className ? ` ${className}` : ''}`} data-above={above} data-align={align} role="group" aria-label={label}>
    {options.map(option=><button type="button" key={option.value} aria-pressed={value===option.value} onClick={()=>onSelect(option.value)}><span>{option.label}</span>{option.suffix&&<span>{option.suffix}</span>}</button>)}
    {children}
  </div>;
}
