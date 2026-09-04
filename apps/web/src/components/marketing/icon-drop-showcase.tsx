"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";

const icons = [
  ["isometric-3d", "/images/icon-style-previews/isometric-3d-hd.png"],
  ["neon", "/images/icon-style-previews/neon-hd.png"],
  ["low-poly", "/images/icon-style-previews/low-poly-hd.png"],
  ["clay-3d", "/images/icon-style-previews/clay-3d-hd.png"],
  ["flat-playful", "/images/icon-style-previews/hd-native/flat-playful-v13.png"],
  ["pixel-art", "/images/icon-style-previews/pixel-art-hd.png"],
  ["flat-illustration", "/images/icon-style-previews/flat-illustration-hd.png"],
  ["cute-sticker", "/images/icon-style-previews/cute-sticker-hd.png"],
  ["minimal-logo", "/images/icon-style-previews/minimal-logo-hd.png"],
] as const;

export function IconDropShowcase({ locale }: { locale: "en" | "zh" }) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      section.style.setProperty("--drop-progress", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(rect.height - window.innerHeight * 0.45, 1);
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.82 - rect.top) / travel));
      section.style.setProperty("--drop-progress", progress.toFixed(4));
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <section ref={sectionRef} className="icon-drop" aria-labelledby="icon-drop-title">
      <div className="icon-drop__copy">
        <p className="butter-kicker">ICON SYSTEM / 09</p>
        <h2 id="icon-drop-title">
          {locale === "zh" ? "九种风格，落在同一套系统里。" : "Nine styles. One system that lands together."}
        </h2>
      </div>
      <div className="icon-drop__stage">
        <div className="icon-drop__grid">
          {icons.map(([name, src], index) => {
            const style = {
              "--drop-delay": String(index * 0.055),
              "--drop-x": `${[-34, 12, 38, -18, 26, -40, 18, -8, 32][index]}vw`,
              "--drop-rotate": `${[-24, 18, -14, 22, -18, 15, -20, 13, -16][index]}deg`,
            } as CSSProperties;
            return (
              <figure key={name} style={style} className="icon-drop__item">
                <Image src={src} alt={`${name} ${locale === "zh" ? "品牌图标" : "brand icon"}`} width={512} height={512} sizes="(max-width: 700px) 27vw, 18vw" />
                <figcaption>{name.replaceAll("-", " ")}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
