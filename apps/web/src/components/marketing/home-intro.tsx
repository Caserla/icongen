"use client";

import { useEffect, useState } from "react";

export function HomeIntro({ locale }: { locale: "en" | "zh" }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (window.sessionStorage.getItem("easy-design-home-intro-seen") === "1") {
      const frame = window.requestAnimationFrame(() => setVisible(false));
      return () => window.cancelAnimationFrame(frame);
    }
    window.sessionStorage.setItem("easy-design-home-intro-seen", "1");
    const timeout = window.setTimeout(
      () => setVisible(false),
      reduced ? 80 : 1600,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="butter-intro"
      role="status"
      aria-label={
        locale === "zh" ? "正在打开图标创作空间" : "Opening the icon workspace"
      }
    >
      <div className="butter-intro__grid" aria-hidden="true" />
      <div className="butter-intro__copy">
        <span>EASY ICON</span>
        <strong>
          {locale === "zh" ? "让图标成套发生" : "Icons, built as a set"}
        </strong>
      </div>
      <div className="butter-intro__rail" aria-hidden="true">
        <i>✦</i>
        <i>●</i>
        <i>⌁</i>
        <i>◆</i>
        <i>✦</i>
      </div>
      <span className="butter-intro__progress" aria-hidden="true" />
    </div>
  );
}
