-- User-owned projects group interaction-icon generation jobs without changing
-- the existing subject -> variant -> asset hierarchy beneath each job.
create table public.icon_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index icon_projects_user_name_idx
  on public.icon_projects(user_id, lower(trim(name)));
create index icon_projects_user_updated_idx
  on public.icon_projects(user_id, updated_at desc);

create trigger icon_projects_set_updated_at
  before update on public.icon_projects
  for each row execute function public.set_updated_at();

alter table public.icon_projects enable row level security;
create policy "users read own icon projects" on public.icon_projects
  for select using (user_id = auth.uid());
create policy "users create own icon projects" on public.icon_projects
  for insert with check (user_id = auth.uid());
create policy "users update own icon projects" on public.icon_projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own icon projects" on public.icon_projects
  for delete using (user_id = auth.uid());

alter table public.generation_jobs
  add column project_id uuid references public.icon_projects(id) on delete set null;
create index generation_jobs_project_created_idx
  on public.generation_jobs(project_id, created_at desc)
  where project_id is not null;

create or replace function public.create_generation_job_v2(
  p_user_id uuid,
  p_spec jsonb,
  p_skill_version text,
  p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job_id uuid;
  v_project_id uuid;
  v_subject jsonb;
  v_subject_id uuid;
  v_position integer := 0;
  v_subject_count integer;
  v_balance integer;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception using message = 'NOT_AUTHORIZED';
  end if;
  if (select status from public.profiles where id = p_user_id) <> 'active' then
    raise exception using message = 'ACCOUNT_NOT_ACTIVE';
  end if;
  if coalesce(p_spec->>'settingsVersion', '') = '' then
    raise exception using message = 'SETTINGS_VERSION_REQUIRED';
  end if;
  if jsonb_typeof(p_spec->'subjects') <> 'array' then
    raise exception using message = 'SUBJECTS_MUST_BE_ARRAY';
  end if;

  if nullif(p_spec->>'projectId', '') is not null then
    begin
      v_project_id := (p_spec->>'projectId')::uuid;
    exception when invalid_text_representation then
      raise exception using message = 'INVALID_PROJECT_ID';
    end;
    if not exists (
      select 1 from public.icon_projects
      where id = v_project_id and user_id = p_user_id
    ) then raise exception using message = 'PROJECT_NOT_FOUND'; end if;
  end if;

  v_subject_count := jsonb_array_length(p_spec->'subjects');
  if v_subject_count < 1 or v_subject_count > 20 then
    raise exception using message = 'SUBJECT_COUNT_OUT_OF_RANGE';
  end if;

  select id into v_job_id from public.generation_jobs
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if v_job_id is not null then return v_job_id; end if;

  if exists (
    select 1 from public.generation_jobs
    where user_id = p_user_id and status in ('queued', 'processing')
  ) then raise exception using message = 'ACTIVE_GENERATION_EXISTS'; end if;

  select balance into v_balance from public.credit_accounts
  where user_id = p_user_id for update;
  if not found then raise exception using message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;
  if v_balance < v_subject_count then
    raise exception using
      message = 'INSUFFICIENT_CREDITS',
      detail = jsonb_build_object('required', v_subject_count, 'balance', v_balance)::text;
  end if;

  insert into public.generation_jobs (
    user_id, project_id, description, skill_version, credit_cost, settings_version,
    generation_spec, subject_count, variants_per_subject, progress_phase, idempotency_key
  ) values (
    p_user_id, v_project_id, left(p_spec->'subjects'->0->>'description', 1000), p_skill_version,
    v_subject_count, p_spec->>'settingsVersion', p_spec, v_subject_count, 3,
    'queued', p_idempotency_key
  ) returning id into v_job_id;

  for v_subject in select value from jsonb_array_elements(p_spec->'subjects') loop
    insert into public.generation_subjects (
      job_id, client_id, name, description, position, color_override
    ) values (
      v_job_id, v_subject->>'clientId', v_subject->>'name',
      v_subject->>'description', v_position, v_subject->'colorOverride'
    ) returning id into v_subject_id;
    insert into public.generation_variants(subject_id, slot)
    values (v_subject_id, 1), (v_subject_id, 2), (v_subject_id, 3);
    v_position := v_position + 1;
  end loop;

  update public.credit_accounts
  set balance = balance - v_subject_count, updated_at = now()
  where user_id = p_user_id returning balance into v_balance;

  insert into public.credit_ledger (
    user_id, entry_type, amount, balance_after, generation_job_id,
    idempotency_key, note
  ) values (
    p_user_id, 'generation_debit', -v_subject_count, v_balance, v_job_id,
    'generation-debit:' || p_idempotency_key::text,
    v_subject_count::text || case when v_subject_count = 1 then ' icon subject' else ' icon subjects' end
  );

  if v_project_id is not null then
    update public.icon_projects set updated_at = now() where id = v_project_id;
  end if;
  return v_job_id;
end;
$$;

revoke all on function public.create_generation_job_v2(uuid, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_generation_job_v2(uuid, jsonb, text, uuid)
  to authenticated, service_role;
