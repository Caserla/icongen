"use client";

import { useEffect, useState } from "react";
import { recolorPreviewSvg, type ManualPreviewColor } from "../manual-preview-color";
import { previewPaletteFor } from "../preview-svg-palette";

export function ManualColorPreviewImage({ src, manualColor, className, alt }: { src: string; manualColor: ManualPreviewColor | null; className?: string; alt: string }) {
  const [renderedSrc, setRenderedSrc] = useState(src);

  useEffect(() => {
    let active = true;
    if (!manualColor || manualColor.src.split("?")[0] !== src.split("?")[0]) { setRenderedSrc(src); return; }
    void fetch(src)
      .then(response => response.ok ? response.text() : Promise.reject(new Error("preview unavailable")))
      .then(svg => {
        if (!active) return;
        const original = previewPaletteFor(src, window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (!original) { setRenderedSrc(src); return; }
        setRenderedSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(recolorPreviewSvg(svg, original, manualColor))}`);
      })
      .catch(() => { if (active) setRenderedSrc(src); });
    return () => { active = false; };
  }, [src, manualColor]);

  return <img className={className} src={renderedSrc} alt={alt} />;
}
