"use client";
import { useLocale } from "./locale-provider";
export function LanguageSwitch(){const{locale,setLocale}=useLocale();return <div className="language-switch" aria-label="Language / 语言"><button type="button" onClick={()=>setLocale("en")} aria-pressed={locale==="en"} className="language-switch__option focus-ring">EN</button><span aria-hidden="true"/><button type="button" onClick={()=>setLocale("zh")} aria-pressed={locale==="zh"} className="language-switch__option focus-ring">中文</button></div>}
