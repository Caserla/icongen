alter table public.icon_projects
  add column if not exists theme jsonb,
  add column if not exists theme_status text not null default 'pending',
  add column if not exists theme_source text not null default 'preset',
  add column if not exists theme_failure_reason text,
  add column if not exists theme_generated_at timestamptz;

alter table public.icon_projects drop constraint if exists icon_projects_theme_status_check;
alter table public.icon_projects add constraint icon_projects_theme_status_check check (theme_status in ('pending','ready','failed'));
alter table public.icon_projects drop constraint if exists icon_projects_theme_source_check;
alter table public.icon_projects add constraint icon_projects_theme_source_check check (theme_source in ('preset','ai','manual'));
