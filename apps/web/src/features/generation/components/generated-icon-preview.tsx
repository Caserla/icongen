"use client";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";

export function GeneratedIconPreview({ src, alt, locale, showSkeleton = true, onSettled }: { src: string; alt: string; locale: "en" | "zh"; showSkeleton?: boolean; onSettled?: () => void }) {
  return <ImageWithSkeleton
    src={src}
    alt={alt}
    className="aspect-square w-full"
    failureLabel={locale === "zh" ? "加载失败" : "Failed to load"}
    showSkeleton={showSkeleton}
    onLoad={onSettled}
    onError={onSettled}
  />;
}
