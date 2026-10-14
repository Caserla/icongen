/* eslint-disable @next/next/no-img-element -- Local SVG previews need direct data URLs. */
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/i18n/theme-switch";
import { recolorPreviewSvg, type ManualPreviewColor } from "../manual-preview-color";
import { previewPaletteFor } from "../preview-svg-palette";

export function ManualColorPreviewImage({ src, manualColor, className, alt }: { src: string; manualColor: ManualPreviewColor | null; className?: string; alt: string }) {
  const theme = useTheme();
  const [renderedSrc, setRenderedSrc] = useState(src);
  const isLibraryPreview = previewPaletteFor(src, theme === "dark") !== null;
  const useOriginal = !isLibraryPreview && (!manualColor || manualColor.src.split("?")[0] !== src.split("?")[0]);

  useEffect(() => {
    let active = true;
    if (useOriginal) return;
    void fetch(src)
      .then(response => response.ok ? response.text() : Promise.reject(new Error("preview unavailable")))
      .then(svg => {
        if (!active) return;
        const original = previewPaletteFor(src, theme === "dark");
        if (!original) { setRenderedSrc(src); return; }
        const recolored = isLibraryPreview
          ? svg.replace(/\bcolor="#[0-9a-f]{6}"/i, `color="${manualColor?.solid ?? original.solid}"`)
          : recolorPreviewSvg(svg, original, manualColor!);
        setRenderedSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(recolored)}`);
      })
      .catch(() => { if (active) setRenderedSrc(src); });
    return () => { active = false; };
  }, [src, manualColor, theme, isLibraryPreview, useOriginal]);

  return <img className={className} src={useOriginal ? src : renderedSrc} alt={alt} />;
}
