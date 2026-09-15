"use client";
/* eslint-disable @next/next/no-img-element -- supports authenticated and short-lived asset URLs */

import { useState, type CSSProperties } from "react";
import { SkeletonBlock } from "@/components/ui/page-skeletons";
import { useLocale } from "@/components/i18n/locale-provider";

type Props = {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
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

export function ImageWithSkeleton({
  src,
  fallbackSrc,
  alt,
  className = "",
  style,
  imageStyle,
  imageClassName = "object-contain",
  loading = "lazy",
  failureLabel,
  showSkeleton = true,
  reveal = true,
  onLoad,
  onError,
}: Props) {
  const { locale } = useLocale();
  const resolvedFailureLabel =
    failureLabel ?? (locale === "zh" ? "图片加载失败" : "Image failed to load");
  const [state, setState] = useState({
    src,
    loaded: false,
    failed: false,
    retry: 0,
    usingFallback: false,
  });
  const currentState = state.src === src ? state : { ...state, retry: 0, usingFallback: false };
  const retry = currentState.retry;
  const loaded = state.src === src && state.loaded;
  const failed = state.src === src && state.failed;
  const effectiveSrc = currentState.usingFallback && fallbackSrc ? fallbackSrc : src;
  const retryable = effectiveSrc.includes("/api/generation/");
  const normalizedSrc = normalizeGeneratedAssetUrl(effectiveSrc);
  const resolvedSrc =
    retry > 0
      ? `${normalizedSrc}${normalizedSrc.includes("?") ? "&" : "?"}refresh=${retry}`
      : normalizedSrc;

  return (
    <span
      data-image-state={
        failed ? "failed" : loaded && reveal ? "loaded" : "loading"
      }
      className={`relative block overflow-hidden ${className}`}
      style={style}
    >
      {showSkeleton && (!loaded || !reveal) && !failed ? (
        <span className="absolute inset-0">
          <SkeletonBlock className="h-full w-full rounded-[inherit]" />
        </span>
      ) : null}
      {failed ? (
        <span className="absolute inset-0 grid place-items-center bg-surface-muted px-3 text-center text-sm font-semibold text-muted">
          {resolvedFailureLabel}
        </span>
      ) : null}
      {!failed ? (
        <img
          src={resolvedSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={async (event) => {
            const image = event.currentTarget;
            try {
              await image.decode();
            } catch {
              // A completed load is still usable when a browser rejects a redundant
              // decode call (notably WebKit with memory-cached images).
            }
            setState({ src, loaded: true, failed: false, retry, usingFallback: currentState.usingFallback });
            onLoad?.();
          }}
          onError={() => {
            if (fallbackSrc && !currentState.usingFallback) {
              setState({ src, loaded: false, failed: false, retry: 0, usingFallback: true });
              return;
            }
            if (retryable && retry < 1) {
              setState({ src, loaded: false, failed: false, retry: retry + 1, usingFallback: currentState.usingFallback });
              return;
            }
            setState({ src, loaded: false, failed: true, retry, usingFallback: currentState.usingFallback });
            onError?.();
          }}
          className={`relative z-[1] h-full w-full transition-opacity duration-200 ${loaded && reveal ? "opacity-100" : "opacity-0"} ${imageClassName}`}
          style={imageStyle}
        />
      ) : null}
    </span>
  );
}
