do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_svg_icons'
      and policyname = 'users delete own svg icons'
  ) then
    create policy "users delete own svg icons" on public.project_svg_icons
      for delete using (
        exists (
          select 1
          from public.project_svg_icon_sets
          where id = set_id
            and user_id = auth.uid()
        )
      );
  end if;
end $$;
