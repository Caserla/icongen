-- Editable SVG sets generated on the icon canvas, separate from raster generation jobs.
create table public.project_svg_icon_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.icon_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan jsonb not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index project_svg_icon_sets_project_created_idx
  on public.project_svg_icon_sets(project_id, created_at desc);

create table public.project_svg_icons (
  set_id uuid not null references public.project_svg_icon_sets(id) on delete cascade,
  subject_id text not null,
  svg text not null check (octet_length(svg) <= 100000),
  created_at timestamptz not null default now(),
  primary key (set_id, subject_id)
);

alter table public.project_svg_icon_sets enable row level security;
create policy "users read own svg icon sets" on public.project_svg_icon_sets
  for select using (user_id = auth.uid());
create policy "users create own svg icon sets" on public.project_svg_icon_sets
  for insert with check (user_id = auth.uid() and exists (
    select 1 from public.icon_projects where id = project_id and user_id = auth.uid()
  ));
alter table public.project_svg_icons enable row level security;
create policy "users read own svg icons" on public.project_svg_icons
  for select using (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));
create policy "users create own svg icons" on public.project_svg_icons
  for insert with check (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));
create policy "users update own svg icons" on public.project_svg_icons
  for update using (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  )) with check (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));
