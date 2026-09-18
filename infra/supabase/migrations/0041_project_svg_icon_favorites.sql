-- Project-scoped favorites for individual SVG icons generated on the canvas.
alter table public.project_svg_icons
  add column if not exists is_favorite boolean not null default false;

create index if not exists project_svg_icons_favorite_idx
  on public.project_svg_icons(set_id, is_favorite)
  where is_favorite = true;
