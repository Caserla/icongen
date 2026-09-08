import type { ReactNode } from "react";

export function StudioSideCard({
  title,
  description,
  meta,
  children,
  className = "",
}: {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`creation-side-card ${className}`.trim()}>
      <div className="icon-subject-heading">
        <div className="icon-subject-heading__title">
          <h2 className="text-xl font-black">{title}</h2>
          {meta}
        </div>
        {description ? (
          <p className="icon-subject-heading__description text-sm text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
