"use client";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";

export function GeneratedIconPreview({
  src,
  fallbackSrc,
  alt,
  locale,
  showSkeleton = true,
  loading = "lazy",
  onSettled,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  locale: "en" | "zh";
  showSkeleton?: boolean;
  loading?: "eager" | "lazy";
  onSettled?: () => void;
}) {
  return (
    <ImageWithSkeleton
      src={src}
      fallbackSrc={fallbackSrc}
      alt={alt}
      className="aspect-square w-full"
      failureLabel={locale === "zh" ? "加载失败" : "Failed to load"}
      showSkeleton={showSkeleton}
      loading={loading}
      onLoad={onSettled}
      onError={onSettled}
    />
  );
}
