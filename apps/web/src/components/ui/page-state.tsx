"use client";
import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
const css={state:"page-state-state",art:"page-state-art",action:"page-state-action",spinner:"page-state-spinner"};

export function PageState({kind="loading"}:{kind?:"loading"|"empty"}) {
  const {locale}=useLocale(); const zh=locale==="zh";
  return <section className={css.state} data-state={kind} role="status" aria-busy={kind==="loading"}>
    {kind==="loading"?<><span className={css.spinner} aria-hidden="true"/><p>{zh?"正在加载…":"Loading…"}</p></>:<>
      <div className={css.art}><svg aria-hidden="true" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="13" y="13" width="22" height="22" rx="6"/><rect x="45" y="13" width="22" height="22" rx="6"/><rect x="13" y="45" width="22" height="22" rx="6"/><path d="M56 46v20M46 56h20"/></svg></div>
      <h2>{zh?"暂无图标":"No icons yet"}</h2>
      <Link className={css.action} href="/create"><Glyph/>{zh?"创建图标":"Create icon"}</Link>
    </>}
  </section>;
}
function Glyph(){return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16M4 12h16"/></svg>}
