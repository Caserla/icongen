-- Persist each generated icon set's position in the project canvas.
alter table public.project_svg_icon_sets
  add column canvas_position jsonb not null default '{"x":0,"y":0}'::jsonb,
  add column is_favorite boolean not null default false;

alter table public.project_svg_icon_sets
  add constraint project_svg_icon_sets_canvas_position_shape check (
    jsonb_typeof(canvas_position) = 'object'
    and jsonb_typeof(canvas_position -> 'x') = 'number'
    and jsonb_typeof(canvas_position -> 'y') = 'number'
    and abs((canvas_position ->> 'x')::numeric) <= 100000
    and abs((canvas_position ->> 'y')::numeric) <= 100000
  );

create policy "users update own svg icon sets" on public.project_svg_icon_sets
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.icon_projects where id = project_id and user_id = auth.uid()
  ));

create policy "users delete own svg icon sets" on public.project_svg_icon_sets
  for delete using (user_id = auth.uid());
