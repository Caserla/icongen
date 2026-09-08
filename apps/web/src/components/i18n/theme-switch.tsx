"use client";

import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";

export function useTheme() {
  return useSyncExternalStore(subscribeToTheme, getTheme, () => "dark" as Theme);
}

export function ThemeSwitch() {
  const theme = useTheme();
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("icongen-theme", next);
    window.dispatchEvent(new Event("icongen-theme-changed"));
  }
  const isLight = theme === "light";
  return (
    <button type="button" className="theme-switch focus-ring" onClick={toggleTheme} aria-label={isLight ? "切换到深色主题 / Switch to dark theme" : "切换到浅色主题 / Switch to light theme"} title={isLight ? "Dark theme" : "Light theme"}>
      <span key={theme} aria-hidden="true" className="theme-switch__icon">
        {isLight ? <svg viewBox="0 0 24 24"><path d="M20.2 15.4A8.4 8.4 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" /></svg> : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>}
      </span>
    </button>
  );
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener("icongen-theme-changed", callback);
  return () => window.removeEventListener("icongen-theme-changed", callback);
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
