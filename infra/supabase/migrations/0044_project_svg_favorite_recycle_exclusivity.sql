-- A generated SVG group/icon cannot be both favorited and recycled.
update public.project_svg_icon_sets
set is_favorite = false
where recycled_at is not null and is_favorite;

update public.project_svg_icons
set is_favorite = false
where recycled_at is not null and is_favorite;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_svg_icon_sets_favorite_recycle_exclusive'
      and conrelid = 'public.project_svg_icon_sets'::regclass
  ) then
    alter table public.project_svg_icon_sets
      add constraint project_svg_icon_sets_favorite_recycle_exclusive
      check (not (is_favorite and recycled_at is not null));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_svg_icons_favorite_recycle_exclusive'
      and conrelid = 'public.project_svg_icons'::regclass
  ) then
    alter table public.project_svg_icons
      add constraint project_svg_icons_favorite_recycle_exclusive
      check (not (is_favorite and recycled_at is not null));
  end if;
end $$;
