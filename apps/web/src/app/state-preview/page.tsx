"use client";

import { useState } from "react";
import styles from "./preview.module.css";

export default function StatePreview() {
  const [state, setState] = useState("loading");
  const [light, setLight] = useState(true);
  return <main className={styles.page} data-light={light}>
    <header className={styles.header}><div><small>ESDESIGN / 状态样式预览</small><h1>我的图标</h1></div><button onClick={()=>setLight(!light)}>{light?"深色预览":"浅色预览"}</button></header>
    <nav className={styles.tabs}>{[["loading","加载中"],["empty","暂无图标"]].map(([id,label])=><button key={id} aria-pressed={state===id} onClick={()=>setState(id)}>{label}</button>)}</nav>
    <section key={state} className={styles.panel} aria-live="polite">
      {state==="loading"?<div className={styles.pageLoading} role="status"><span className={styles.pageSpinner} aria-hidden="true"/><p>正在加载…</p></div>:<div className={styles.message} data-empty>
        <div className={styles.art}><svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="13" y="13" width="22" height="22" rx="6"/><rect x="45" y="13" width="22" height="22" rx="6"/><rect x="13" y="45" width="22" height="22" rx="6"/><path d="M56 46v20M46 56h20"/></svg></div>
        <h2>暂无图标</h2>
        <button className={styles.primary} onClick={()=>setState("loading")}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v16M4 12h16"/></svg>创建第一个图标</button>
        <span className={styles.note}>样式预览 · 按钮仅演示加载状态</span>
      </div>}
    </section>
  </main>;
}
