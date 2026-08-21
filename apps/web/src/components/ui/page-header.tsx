export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <header className="max-w-3xl border-b border-border pb-7">
      {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-brand">{eyebrow}</p> : null}
      <h1 className="display-serif text-4xl font-medium leading-[1.05] tracking-[-.045em] text-foreground sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
    </header>
  );
}
