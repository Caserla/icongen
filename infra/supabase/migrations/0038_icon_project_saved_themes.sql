alter table public.icon_projects
  add column if not exists ai_theme jsonb,
  add column if not exists custom_theme jsonb;

update public.icon_projects
set ai_theme = theme
where theme_source = 'ai' and theme is not null and ai_theme is null;

update public.icon_projects
set custom_theme = theme
where theme_source = 'manual' and theme is not null and custom_theme is null;
