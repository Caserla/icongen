"use client";
/* eslint-disable @next/next/no-img-element -- supports authenticated and short-lived asset URLs */

import { useState } from "react";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
import { useLocale } from "@/components/i18n/locale-provider";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
  failureLabel?: string;
  showSkeleton?: boolean;
  reveal?: boolean;
  onLoad?: () => void;
  onError?: () => void;
};

export function normalizeGeneratedAssetUrl(src: string) {
  try {
    const url = new URL(src, "http://internal.invalid");
    if (url.pathname.startsWith("/api/generation/"))
      return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Leave malformed external input untouched so the normal image error UI
    // remains responsible for displaying the failure.
  }
  return src;
}

export function ImageWithSkeleton({ src, alt, className = "", imageClassName = "object-contain", loading = "lazy", failureLabel, showSkeleton = true, reveal = true, onLoad, onError }: Props) {
  const { locale } = useLocale();
  const resolvedFailureLabel = failureLabel ?? (locale === "zh" ? "图片加载失败" : "Image failed to load");
  const [state, setState] = useState({ src, loaded: false, failed: false, retry: 0 });
  const retry = state.src === src ? state.retry : 0;
  const loaded = state.src === src && state.loaded;
  const failed = state.src === src && state.failed;
  const retryable = src.includes("/api/generation/");
  const normalizedSrc = normalizeGeneratedAssetUrl(src);
  const resolvedSrc = retry > 0
    ? `${normalizedSrc}${normalizedSrc.includes("?") ? "&" : "?"}refresh=${retry}`
    : normalizedSrc;

  return <span data-image-state={failed ? "failed" : loaded && reveal ? "loaded" : "loading"} className={`relative block overflow-hidden ${className}`}>
    {showSkeleton && (!loaded || !reveal) && !failed ? <span className="absolute inset-0"><SkeletonBlock className="h-full w-full rounded-[inherit]" /></span> : null}
    {failed ? <span className="absolute inset-0 grid place-items-center bg-surface-muted px-3 text-center text-sm font-semibold text-muted">{resolvedFailureLabel}</span> : null}
    {!failed ? <img src={resolvedSrc} alt={alt} loading={loading} decoding="async" onLoad={() => { setState({ src, loaded: true, failed: false, retry }); onLoad?.(); }} onError={() => {
      if (retryable && retry < 1) {
        setState({ src, loaded: false, failed: false, retry: retry + 1 });
        return;
      }
      setState({ src, loaded: false, failed: true, retry });
      onError?.();
    }} className={`relative z-[1] h-full w-full transition-opacity duration-200 ${loaded && reveal ? "opacity-100" : "opacity-0"} ${imageClassName}`} /> : null}
  </span>;
}
