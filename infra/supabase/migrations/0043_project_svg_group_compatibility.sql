-- Backfill group-level fields for environments that received later SVG
-- migrations without the original position/favorite migration.
alter table public.project_svg_icon_sets
  add column if not exists canvas_position jsonb not null default '{"x":0,"y":0}'::jsonb,
  add column if not exists is_favorite boolean not null default false,
  add column if not exists recycled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_svg_icon_sets_canvas_position_shape'
      and conrelid = 'public.project_svg_icon_sets'::regclass
  ) then
    alter table public.project_svg_icon_sets
      add constraint project_svg_icon_sets_canvas_position_shape check (
        jsonb_typeof(canvas_position) = 'object'
        and jsonb_typeof(canvas_position -> 'x') = 'number'
        and jsonb_typeof(canvas_position -> 'y') = 'number'
        and abs((canvas_position ->> 'x')::numeric) <= 100000
        and abs((canvas_position ->> 'y')::numeric) <= 100000
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_svg_icon_sets' and policyname = 'users update own svg icon sets') then
    create policy "users update own svg icon sets" on public.project_svg_icon_sets
      for update using (user_id = auth.uid())
      with check (user_id = auth.uid() and exists (
        select 1 from public.icon_projects where id = project_id and user_id = auth.uid()
      ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_svg_icon_sets' and policyname = 'users delete own svg icon sets') then
    create policy "users delete own svg icon sets" on public.project_svg_icon_sets
      for delete using (user_id = auth.uid());
  end if;
end $$;

create index if not exists project_svg_icon_sets_recycled_idx
  on public.project_svg_icon_sets(project_id, recycled_at, created_at desc);
