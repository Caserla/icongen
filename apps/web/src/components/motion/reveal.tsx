"use client";

import { useEffect, useRef, type PropsWithChildren } from "react";

export function Reveal({ children, className = "", delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.dataset.visible = "true";
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.dataset.visible = "true";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10%", threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={`motion-reveal ${className}`} style={{ "--motion-delay": `${delay}ms` } as React.CSSProperties}>{children}</div>;
}
