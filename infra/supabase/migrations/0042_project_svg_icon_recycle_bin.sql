-- Recoverable, project-scoped recycle bin for generated SVG groups and icons.
alter table public.project_svg_icon_sets
  add column if not exists recycled_at timestamptz;

alter table public.project_svg_icons
  add column if not exists recycled_at timestamptz;

create index if not exists project_svg_icon_sets_recycled_idx
  on public.project_svg_icon_sets(project_id, recycled_at, created_at desc);

create index if not exists project_svg_icons_recycled_idx
  on public.project_svg_icons(set_id, recycled_at);
