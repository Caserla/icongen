"use client";

import { createPortal } from "react-dom";
import drawerStyles from "@/features/library/library.module.css";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { ImageWithSkeleton } from "@/components/ui/image-with-skeleton";
import { Toast } from "@/components/ui/toast";

export type FavoriteItem = {
  id: string;
  variantId: string;
  jobId: string;
  subjectName: string;
  slot: number;
  usage?: string;
  stylePreset?: string;
  previewUrl?: string;
  createdAt: string;
};

type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggleFavorite: (variantId: string, seed?: Omit<FavoriteItem, "id" | "createdAt">) => Promise<void>;
  busyIds: Set<string>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isLoading = !loaded || busyIds.size > 0 || removing;

  const load = useCallback(async () => {
    setLoaded(false);
    setLoadFailed(false);
    try {
      const response = await fetch("/api/generation/favorites", { cache: "no-store" });
      if (!response.ok) throw new Error("favorites failed");
      const payload = (await response.json()) as { items: FavoriteItem[] };
      setItems(payload.items);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeDrawer(); };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!drawerRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeDrawer();
    };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  });
  const selectedVariantIds = useMemo(
    () => items.filter((item) => selectedIds.has(item.variantId)).map((item) => item.variantId),
    [items, selectedIds],
  );

  function closeDrawer() {
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 220);
  }

  const toggleFavorite = useCallback(async (variantId: string, seed?: Omit<FavoriteItem, "id" | "createdAt">) => {
    if (busyIds.has(variantId)) return;
    const existing = items.find((item) => item.variantId === variantId);
    const optimistic = existing ? null : seed ? { ...seed, id: `optimistic-${variantId}`, createdAt: new Date().toISOString() } : null;
    setBusyIds((current) => new Set(current).add(variantId));
    setItems((current) => existing ? current.filter((item) => item.variantId !== variantId) : optimistic ? [optimistic, ...current] : current);
    try {
      const response = await fetch(existing ? `/api/generation/favorites/${variantId}` : "/api/generation/favorites", {
        method: existing ? "DELETE" : "POST",
        headers: existing ? undefined : { "content-type": "application/json" },
        body: existing ? undefined : JSON.stringify({ variantId }),
      });
      if (!response.ok) throw new Error("favorite failed");
      await load();
    } catch {
      setItems((current) => existing ? [existing, ...current] : current.filter((item) => item.variantId !== variantId));
      setMessage(locale === "zh" ? "收藏操作失败，请重试。" : "The favorite could not be updated.");
    } finally {
      setBusyIds((current) => { const next = new Set(current); next.delete(variantId); return next; });
    }
  }, [busyIds, items, load, locale]);

  async function download(variantIds: string[]) {
    if (!variantIds.length || downloading) return;
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/api/generation/favorites/downloads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantIds }),
      });
      if (!response.ok) throw new Error("download failed");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = variantIds.length === 1 ? "easy-design-favorite.zip" : "easy-design-favorites.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage(locale === "zh" ? "下载准备失败，请稍后重试。" : "The download could not be prepared.");
    } finally { setDownloading(false); }
  }

  async function removeSelected() {
    const variantIds = selectedVariantIds;
    if (!variantIds.length || removing) return;
    setRemoving(true);
    setMessage("");
    const previous = items;
    setItems((current) => current.filter((item) => !variantIds.includes(item.variantId)));
    try {
      const response = await fetch("/api/generation/favorites", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantIds }),
      });
      if (!response.ok) throw new Error("remove failed");
      setSelectedIds(new Set());
      await load();
    } catch {
      setItems(previous);
      setMessage(locale === "zh" ? "所选收藏移除失败，请重试。" : "The selected favorites could not be removed.");
    } finally {
      setRemoving(false);
    }
  }

  function toggleSelected(variantId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId); else next.add(variantId);
      return next;
    });
  }

  const value = useMemo(() => ({ favoriteIds: new Set(items.map((item) => item.variantId)), toggleFavorite, busyIds }), [busyIds, items, toggleFavorite]);
  return (
    <FavoritesContext.Provider value={value}>
      {children}
      {loadFailed ? <Toast message={locale === "zh" ? "网络异常，收藏加载失败" : "Network error. Favorites could not be loaded."} variant="error" /> : null}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={locale === "zh" ? `打开收藏，共 ${items.length} 项` : `Open favorites, ${items.length} items`}
        className="favorites-float focus-ring"
      >
        <StarIcon />
        <span>{locale === "zh" ? "打开收藏夹" : "Open favorites"}</span>
      </button>
      {open ? createPortal(<>
          <div aria-hidden="true" className={drawerStyles.drawerBackdrop} data-closing={closing}/>
          <aside ref={drawerRef} role="dialog" aria-modal="false" aria-label={locale === "zh" ? "收藏的图标" : "Favorite icons"} onPointerDown={(event) => event.stopPropagation()} className={`favorites-drawer ${drawerStyles.libraryDrawer} ${closing ? "is-closing" : ""}`}>
            <header className="flex items-center justify-between gap-4 px-5 py-4">
              <div><h2 className="text-lg font-black">{locale === "zh" ? "收藏的图标" : "Favorite icons"}</h2><p className="mt-1 text-xs text-muted">{locale === "zh" ? `${items.length} 个方案` : `${items.length} options`}</p></div>
            </header>
            {!isLoading && !loadFailed && items.length > 0 ? <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><p className="text-xs font-bold text-muted">{locale === "zh" ? `已选择 ${selectedVariantIds.length} 项` : `${selectedVariantIds.length} selected`}</p><button type="button" onClick={() => setSelectedIds(selectedVariantIds.length === items.length ? new Set() : new Set(items.map((item) => item.variantId)))} className="favorites-select-all studio-button studio-button--secondary px-3 py-2 text-xs font-bold">{selectedVariantIds.length === items.length ? (locale === "zh" ? "取消全选" : "Clear all") : (locale === "zh" ? "全选" : "Select all")}</button></div> : null}
            <div className="favorites-grid scrollbar-hidden flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              {isLoading ? <div role="status" aria-busy="true" className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center"><span className="page-state-spinner" aria-hidden="true" /><p>{locale === "zh" ? "正在加载…" : "Loading…"}</p></div> : null}
              {!isLoading && !loadFailed && !items.length ? <div className="grid flex-1 place-items-center px-8 text-center"><div className="flex flex-col items-center justify-center gap-3"><StarIcon className="size-10" /><p className="font-bold">{locale === "zh" ? "暂无收藏" : "No favorites yet"}</p></div></div> : null}
              {!isLoading && !loadFailed && items.length > 0 ? <div className="grid grid-cols-2 gap-3">{items.map((item) => { const selected = selectedIds.has(item.variantId); return <article key={item.variantId} className={`favorites-card relative overflow-hidden rounded-xl bg-[#222226] p-2 ${selected ? "is-selected" : ""}`}><button type="button" aria-pressed={selected} aria-label={locale === "zh" ? `选择 ${item.subjectName} 方案 ${item.slot}` : `Select ${item.subjectName} option ${item.slot}`} onClick={() => toggleSelected(item.variantId)} className={`favorite-card-select focus-ring ${selected ? "studio-selection-check" : ""}`}>{selected ? <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2.2" strokeLinecap="square" strokeLinejoin="miter"><path d="m4.5 12.5 5 5 10-10" /></svg> : null}</button><button type="button" aria-pressed={selected} onClick={() => toggleSelected(item.variantId)} className="favorite-card-content focus-ring block w-full text-left"><div className="aspect-square overflow-hidden rounded-lg bg-transparent">{item.previewUrl ? <ImageWithSkeleton src={item.previewUrl} alt={item.subjectName} className="h-full w-full" /> : null}</div><p className="mt-2 truncate text-sm font-bold">{item.subjectName}</p><p className="mt-1 text-xs text-muted">{locale === "zh" ? `方案 ${item.slot}` : `Option ${item.slot}`}{item.stylePreset ? ` · ${item.stylePreset}` : ""}</p></button><button type="button" onClick={() => void download([item.variantId])} className="studio-button studio-button--secondary mt-2 w-full px-2 py-2 text-xs font-bold">{locale === "zh" ? "下载" : "Download"}</button></article>; })}</div> : null}
            </div>
            <footer className="border-t border-border p-4"><div className="grid grid-cols-2 gap-2"><button type="button" disabled={isLoading || loadFailed || !selectedVariantIds.length || downloading} onClick={() => void download(selectedVariantIds)} className="studio-button studio-button--primary px-4 py-3 text-sm font-black disabled:opacity-40">{downloading ? (locale === "zh" ? "正在准备…" : "Preparing…") : (locale === "zh" ? `下载所选（${selectedVariantIds.length}）` : `Download (${selectedVariantIds.length})`)}</button><button type="button" disabled={isLoading || loadFailed || !selectedVariantIds.length || removing} onClick={() => void removeSelected()} className="favorites-remove-selected studio-button studio-button--secondary px-4 py-3 text-sm font-black disabled:opacity-40">{removing ? (locale === "zh" ? "正在移除…" : "Removing…") : (locale === "zh" ? "移除所选" : "Remove selected")}</button></div>{message ? <Toast message={message} variant="error" /> : null}</footer>
          </aside>
      </>, document.body) : null}
    </FavoritesContext.Provider>
  );
}

export function FavoriteToggle({ item, placement = "preview" }: { item: Omit<FavoriteItem, "id" | "createdAt">; placement?: "preview" | "action" }) {
  const context = useContext(FavoritesContext);
  const { locale } = useLocale();
  if (!context) return null;
  const active = context.favoriteIds.has(item.variantId);
  const busy = context.busyIds.has(item.variantId);
  return <button type="button" disabled={busy} aria-busy={busy} aria-pressed={active} aria-label={active ? (locale === "zh" ? "取消收藏" : "Remove favorite") : (locale === "zh" ? "收藏方案" : "Favorite option")} title={active ? (locale === "zh" ? "已收藏，点击取消" : "Favorited — click to remove") : (locale === "zh" ? "收藏此方案" : "Favorite this option")} onClick={(event) => { event.stopPropagation(); void context.toggleFavorite(item.variantId, item); }} className={`favorite-toggle focus-ring ${placement === "action" ? "favorite-toggle--action" : ""} ${active ? "is-active" : ""}`}>{busy ? <span className="page-state-spinner" style={{ width: 20, height: 20 }} aria-hidden="true" /> : <StarIcon filled={active} />}</button>;
}

function StarIcon({ filled = false, className = "size-5" }: { filled?: boolean; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" /></svg>;
}
