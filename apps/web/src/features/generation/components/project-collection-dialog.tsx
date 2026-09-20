"use client";

import { useEffect, useRef, type ReactNode } from "react";
import css from "./favorite-icon-groups-dialog.module.css";
import libraryCss from "../../library/library.module.css";

export function ProjectCollectionDialog({ open, title, closeLabel, tabsLabel, categories, category, onCategoryChange, onClose, children }: {
  open: boolean;
  title: string;
  closeLabel: string;
  tabsLabel: string;
  categories: { groups: string; icons: string };
  category: "groups" | "icons";
  onCategoryChange: (category: "groups" | "icons") => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  useEffect(() => {
    const node = dialog.current;
    if (!open || !node) return;
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", keepFocusInside);
    return () => node.removeEventListener("keydown", keepFocusInside);
  }, [open, category, children]);
  if (!open) return null;
  return <dialog ref={dialog} className={`${libraryCss.dialog} ${libraryCss.iconDetail} ${css.favoriteDialog}`} data-canvas-controls aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}>
    <button type="button" className={libraryCss.close} onClick={onClose} aria-label={closeLabel}>×</button>
    <div className={`${libraryCss.codeTabs} ${css.categoryTabs}`} aria-label={tabsLabel}>
      <span aria-hidden="true" className={libraryCss.codeTabIndicator} style={{ left: category === "groups" ? "6px" : "calc(50% + 2px)", width: "calc((100% - 16px) / 2)" }} />
      <button type="button" aria-pressed={category === "groups"} onClick={() => onCategoryChange("groups")}>{categories.groups}</button>
      <button type="button" aria-pressed={category === "icons"} onClick={() => onCategoryChange("icons")}>{categories.icons}</button>
    </div>
    {children}
  </dialog>;
}
