export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <header className="space-y-2">
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p> : null}
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
      <p className="max-w-2xl text-base leading-7 text-muted">{description}</p>
    </header>
  );
}
