"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Viewer } from "@/lib/auth/viewer";
import { useLocale } from "@/components/i18n/locale-provider";

export function UserMenu({ viewer }: { viewer: Viewer }) {
  const { t } = useLocale();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [name, setName] = useState(viewer.name);

  useEffect(() => {
    const update = (event: Event) => {
      const next = (event as CustomEvent<{ displayName: string }>).detail
        ?.displayName;
      if (next) setName(next);
    };
    window.addEventListener("icongen-profile-updated", update);
    return () => window.removeEventListener("icongen-profile-updated", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const initial = name.trim().slice(0, 1).toUpperCase() || "B";
  const nameCharacters = Array.from(name);
  const compactName =
    nameCharacters.length > 8
      ? `${nameCharacters.slice(0, 8).join("")}...`
      : name;

  async function signOut() {
    setSigningOut(true);
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
    }).catch(() => null);
    if (response?.ok) {
      router.replace("/");
      router.refresh();
    } else setSigningOut(false);
  }

  return (
    <div ref={menuRef} className="user-menu relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="user-menu__trigger focus-ring flex min-h-11 items-center gap-2 px-2 text-left"
      >
        <span
          aria-hidden="true"
          className="user-menu__avatar grid size-8 shrink-0 place-items-center rounded-full text-sm font-black"
        >
          {initial}
        </span>
        <b title={name} className="hidden whitespace-nowrap text-xs sm:block">
          {compactName}
        </b>
        <span
          aria-hidden="true"
          className={`hidden size-4 shrink-0 items-center justify-center text-muted transition-transform duration-200 ease-out sm:inline-flex ${open ? "rotate-180" : ""}`}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="size-4"
            aria-hidden="true"
          >
            <path
              d="m5.5 7.75 4.5 4.5 4.5-4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
        <div
          role="menu"
          aria-hidden={!open}
          inert={!open}
          data-open={open}
          className="user-menu__panel absolute right-0 top-[calc(100%+12px)] z-40 origin-top-right"
        >
          <div className="user-menu__identity px-3 py-3">
            <b className="block truncate text-sm">{name}</b>
            <p className="mt-1 truncate text-xs text-muted">{viewer.email}</p>
          </div>
          <Link
            role="menuitem"
            href="/account"
            onClick={() => setOpen(false)}
            className="user-menu__item focus-ring flex min-h-11 items-center px-3 text-sm font-bold"
          >
            {t("avatarAndProfile")}
          </Link>
          {viewer.isAdmin ? (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className="user-menu__item focus-ring flex min-h-11 items-center px-3 text-sm font-bold"
            >
              {t("adminConsole")}
            </Link>
          ) : null}
          <button
            role="menuitem"
            type="button"
            disabled={signingOut}
            onClick={signOut}
            className="user-menu__item focus-ring flex min-h-11 w-full items-center px-3 text-left text-sm font-bold text-danger disabled:opacity-50"
          >
            {signingOut ? t("signingOut") : t("signOut")}
          </button>
        </div>
    </div>
  );
}
