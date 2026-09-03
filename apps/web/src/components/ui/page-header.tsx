export function PageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <header className="relative max-w-3xl border-b border-border pb-7">
      {eyebrow ? <p className="draft-label mb-3 text-accent">{eyebrow}</p> : null}
      <h1 className="display-serif text-4xl leading-[1.02] tracking-[-.045em] text-foreground sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
      <span aria-hidden="true" className="absolute -bottom-px left-0 h-[3px] w-20 bg-accent" />
    </header>
  );
}
