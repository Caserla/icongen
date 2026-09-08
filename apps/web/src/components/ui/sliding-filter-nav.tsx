"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";

/** Measures the selected control, including wrapped rows and translated labels. */
export function SlidingFilterNav({ children, ...props }: ComponentProps<"nav">) {
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const root = nav.current;
    const marker = indicator.current;
    if (!root || !marker) return;
    const measure = () => {
      const selected = root.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected) { marker.hidden = true; return; }
      marker.hidden = false;
      marker.style.width = `${selected.offsetWidth}px`;
      marker.style.height = `${selected.offsetHeight}px`;
      marker.style.transform = `translate(${selected.offsetLeft}px, ${selected.offsetTop}px)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Array.from(root.children).forEach(child => { if (child !== marker) observer.observe(child); });
    return () => observer.disconnect();
  }, [children]);
  return <nav {...props} ref={nav} data-sliding-filter>
    <span ref={indicator} className="filter-selection-indicator" aria-hidden="true" />
    {children}
  </nav>;
}
