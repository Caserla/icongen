import type { ReactNode } from "react";

export function StudioDisclosure({
  label,
  value,
  children,
  className = "",
}: {
  label: string;
  value?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={className}>
      <summary>
        <span>{label}</span>
        {value === undefined ? null : <strong>{value}</strong>}
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
