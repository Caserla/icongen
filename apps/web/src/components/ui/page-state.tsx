"use client";
import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
const css={state:"page-state-state",art:"page-state-art",action:"page-state-action",spinner:"page-state-spinner"};

export function PageState({kind="loading",onRetry,title}:{kind?:"loading"|"empty"|"error";onRetry?:()=>void;title?:string}) {
  const {locale}=useLocale(); const zh=locale==="zh";
  return <section className={css.state} data-state={kind} role={kind==="error"?"alert":"status"} aria-busy={kind==="loading"}>
    {kind==="loading"?<><span className={css.spinner} aria-hidden="true"/><p>{zh?"正在加载…":"Loading…"}</p></>:<>
      <div className={css.art}><svg aria-hidden="true" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5">{kind==="empty"?<><rect x="13" y="13" width="22" height="22" rx="6"/><rect x="45" y="13" width="22" height="22" rx="6"/><rect x="13" y="45" width="22" height="22" rx="6"/><path d="M56 46v20M46 56h20"/></>:<><rect x="14" y="18" width="52" height="44" rx="10"/><path d="M40 29v13M40 48v3M25 68h30"/></>}</svg></div>
      <h2>{title??(kind==="empty"?(zh?"暂无图标":"No icons yet"):(zh?"网络问题请稍后重试":"Unable to load. Please try again."))}</h2>
      {kind==="empty"?<Link className={css.action} href="/create"><Glyph/>{zh?"创建图标":"Create icon"}</Link>:<button className={css.action} onClick={onRetry??(()=>window.location.reload())}><Glyph retry/>{zh?"重新加载":"Reload"}</button>}
    </>}
  </section>;
}
function Glyph({retry=false}:{retry?:boolean}){return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={retry?"M20 7v5h-5M20 12a8 8 0 1 0-2.3 5.7":"M12 4v16M4 12h16"}/></svg>}
