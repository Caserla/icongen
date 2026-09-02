"use client";
/* eslint-disable @next/next/no-img-element -- supports authenticated and short-lived asset URLs */

import { useState } from "react";
import { SkeletonBlock } from "@/components/ui/page-skeletons";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
  failureLabel?: string;
  showSkeleton?: boolean;
  onLoad?: () => void;
  onError?: () => void;
};

export function ImageWithSkeleton({ src, alt, className = "", imageClassName = "object-contain", loading = "lazy", failureLabel = "图片加载失败", showSkeleton = true, onLoad, onError }: Props) {
  const [state, setState] = useState({ src, loaded: false, failed: false });
  const loaded = state.src === src && state.loaded;
  const failed = state.src === src && state.failed;

  return <span className={`relative block overflow-hidden ${className}`}>
    {showSkeleton && !loaded && !failed ? <span className="absolute inset-0"><SkeletonBlock className="h-full w-full rounded-[inherit]" /></span> : null}
    {failed ? <span className="absolute inset-0 grid place-items-center bg-surface-muted px-3 text-center text-sm font-semibold text-muted">{failureLabel}</span> : null}
    {!failed ? <img src={src} alt={alt} loading={loading} decoding="async" onLoad={() => { setState({ src, loaded: true, failed: false }); onLoad?.(); }} onError={() => { setState({ src, loaded: false, failed: true }); onError?.(); }} className={`relative z-[1] h-full w-full opacity-100 ${imageClassName}`} /> : null}
  </span>;
}
