"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type CSSProperties,
} from "react";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const [availableHeight, setAvailableHeight] = useState<number>();
  useLayoutEffect(() => {
    const update = () => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setAvailableHeight(Math.max(0, window.innerHeight - top - 24));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, []);
  const closeTimerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    closeTimerRef.current = window.setTimeout(onClose, reduceMotion ? 0 : 300);
  }, [closing, onClose]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target))
        return;
      if (target instanceof Element && target.closest(".studio-color-popover, [data-library-color-popover]"))
        return;
      requestClose();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [requestClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null)
        window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) requestClose();
  }

  return (
    <div
      ref={rootRef}
      style={{ "--background-dialog-max-height": availableHeight === undefined ? undefined : `${availableHeight}px` } as CSSProperties}
      className={`icon-background-dialog icon-background-dialog--auto-height ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={closeFromBackdrop}
    >
      <div className="icon-background-dialog__drawer-clip">
        <div
          ref={panelRef}
          className={`icon-background-dialog__panel${closing ? " is-closing" : ""}`}
        >
          <div className="icon-background-dialog__header">
            <h3>{title}</h3>
            <button
              type="button"
              onClick={requestClose}
              aria-label={closeLabel}
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
