import type { ReactNode } from "react";

export function StudioSettingsPanel({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="creation-control-panel" open={defaultOpen || undefined}>
    <summary>{title}</summary>
    <div className="creation-control-panel__body">{children}</div>
  </details>;
}
