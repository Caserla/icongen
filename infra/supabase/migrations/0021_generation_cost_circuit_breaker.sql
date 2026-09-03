create table if not exists public.generation_runtime_limits (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  max_global_active_jobs integer not null default 3 check (max_global_active_jobs > 0),
  max_global_subjects_per_day integer not null default 300 check (max_global_subjects_per_day > 0),
  max_global_subjects_per_month integer not null default 6000 check (max_global_subjects_per_month > 0),
  max_user_subjects_per_day integer not null default 50 check (max_user_subjects_per_day > 0),
  updated_at timestamptz not null default now()
);

insert into public.generation_runtime_limits(singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.generation_runtime_limits enable row level security;
revoke all on public.generation_runtime_limits from public, anon, authenticated;

create or replace function public.enforce_generation_runtime_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits public.generation_runtime_limits%rowtype;
  v_subject_count integer;
  v_global_today integer;
  v_global_month integer;
  v_user_today integer;
  v_active integer;
begin
  select * into v_limits
  from public.generation_runtime_limits
  where singleton = true
  for update;

  if not found or not v_limits.enforcement_enabled then
    return new;
  end if;

  v_subject_count := case
    when jsonb_typeof(new.generation_spec -> 'subjects') = 'array'
      then jsonb_array_length(new.generation_spec -> 'subjects')
    else 1
  end;

  select count(*) into v_active
  from public.generation_jobs
  where status in ('queued', 'processing');
  if v_active >= v_limits.max_global_active_jobs then
    raise exception 'GENERATION_GLOBAL_CONCURRENCY_LIMIT';
  end if;

  select coalesce(sum(case
    when jsonb_typeof(generation_spec -> 'subjects') = 'array'
      then jsonb_array_length(generation_spec -> 'subjects')
    else 1
  end), 0)
  into v_global_today
  from public.generation_jobs
  where created_at >= date_trunc('day', now());
  if v_global_today + v_subject_count > v_limits.max_global_subjects_per_day then
    raise exception 'GENERATION_GLOBAL_DAILY_LIMIT';
  end if;

  select coalesce(sum(case
    when jsonb_typeof(generation_spec -> 'subjects') = 'array'
      then jsonb_array_length(generation_spec -> 'subjects')
    else 1
  end), 0)
  into v_global_month
  from public.generation_jobs
  where created_at >= date_trunc('month', now());
  if v_global_month + v_subject_count > v_limits.max_global_subjects_per_month then
    raise exception 'GENERATION_GLOBAL_MONTHLY_LIMIT';
  end if;

  select coalesce(sum(case
    when jsonb_typeof(generation_spec -> 'subjects') = 'array'
      then jsonb_array_length(generation_spec -> 'subjects')
    else 1
  end), 0)
  into v_user_today
  from public.generation_jobs
  where user_id = new.user_id
    and created_at >= date_trunc('day', now());
  if v_user_today + v_subject_count > v_limits.max_user_subjects_per_day then
    raise exception 'GENERATION_USER_DAILY_LIMIT';
  end if;

  return new;
end;
$$;

drop trigger if exists generation_jobs_runtime_limits on public.generation_jobs;
create trigger generation_jobs_runtime_limits
  before insert on public.generation_jobs
  for each row execute function public.enforce_generation_runtime_limits();

revoke all on function public.enforce_generation_runtime_limits()
  from public, anon, authenticated;
