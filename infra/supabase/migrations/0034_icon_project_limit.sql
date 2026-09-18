-- Enforce the per-user project limit at the authoritative database boundary.
-- The advisory transaction lock serializes concurrent creates for one user.
create or replace function public.enforce_icon_project_limit()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (
    select count(*) from public.icon_projects where user_id = new.user_id
  ) >= 10 then
    raise exception using message = 'PROJECT_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

create trigger icon_projects_enforce_limit
  before insert on public.icon_projects
  for each row execute function public.enforce_icon_project_limit();
