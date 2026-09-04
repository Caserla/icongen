"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

export function StudioDrawer({
  title,
  closeLabel,
  onClose,
  children,
  className = "",
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeTimerRef.current = window.setTimeout(onClose, reduceMotion ? 0 : 300);
  }, [closing, onClose]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".studio-color-popover")) return;
      requestClose();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [requestClose]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  return (
    <div
      className={`icon-background-dialog ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={closeFromBackdrop}
    >
      <div className="icon-background-dialog__drawer-clip">
        <div ref={panelRef} className={`icon-background-dialog__panel${closing ? " is-closing" : ""}`}>
          <div className="icon-background-dialog__header">
            <h3>{title}</h3>
            <button type="button" onClick={requestClose} aria-label={closeLabel}>×</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
