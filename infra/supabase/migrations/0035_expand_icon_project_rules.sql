-- Final project limits: 20 projects per user; Chinese/mixed names use an
-- 18-character cap, while English names use a 20-word cap.
alter table public.icon_projects
  drop constraint if exists icon_projects_name_check;
alter table public.icon_projects
  add constraint icon_projects_name_check
  check (char_length(trim(name)) between 1 and 160);

create or replace function public.enforce_icon_project_limit()
returns trigger language plpgsql set search_path = public as $$
declare
  v_name text := trim(new.name);
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    if (
      select count(*) from public.icon_projects where user_id = new.user_id
    ) >= 20 then
      raise exception using message = 'PROJECT_LIMIT_REACHED';
    end if;
  end if;

  if v_name ~ '[一-龥]' then
    if char_length(v_name) > 18 then
      raise exception using message = 'PROJECT_NAME_TOO_LONG';
    end if;
  elsif cardinality(regexp_split_to_array(v_name, '\s+')) > 20 then
    raise exception using message = 'PROJECT_NAME_TOO_LONG';
  end if;
  new.name := v_name;
  return new;
end;
$$;

drop trigger if exists icon_projects_enforce_limit on public.icon_projects;
create trigger icon_projects_enforce_limit
  before insert or update of name on public.icon_projects
  for each row execute function public.enforce_icon_project_limit();
