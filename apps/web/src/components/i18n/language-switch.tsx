"use client";
import { useLocale } from "./locale-provider";
export function LanguageSwitch(){const{locale,setLocale}=useLocale();return <div className="draft-control flex gap-1 p-1" aria-label="Language / 语言"><button onClick={()=>setLocale("en")} aria-pressed={locale==="en"} className="draft-option focus-ring min-h-9 w-12 shrink-0 text-xs font-black">EN</button><button onClick={()=>setLocale("zh")} aria-pressed={locale==="zh"} className="draft-option focus-ring min-h-9 w-12 shrink-0 text-xs font-black">中文</button></div>}
