"use client";
/* eslint-disable @next/next/no-img-element -- authenticated previews resolve through a short-lived internal redirect */

import { useState } from "react";

export function GeneratedIconPreview({ assetId, alt, locale }: { assetId: string; alt: string; locale: "en" | "zh" }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return <span className="relative block aspect-square w-full">
    {!loaded ? <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-muted">{failed ? (locale === "zh" ? "加载失败" : "Failed to load") : (locale === "zh" ? "图片加载中…" : "Loading image…")}</span> : null}
    {!failed ? <img
      src={`/api/generation/assets/${assetId}/preview?attempt=${attempt}`}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => { setLoaded(false); if (attempt === 0) setAttempt(1); else setFailed(true); }}
      className={`absolute inset-0 h-full w-full object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
    /> : null}
  </span>;
}
