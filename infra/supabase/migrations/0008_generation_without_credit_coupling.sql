-- Generation owns design specs, execution and assets. Billing/credits are a separate module.
alter table public.generation_jobs
  drop constraint if exists generation_jobs_credit_cost_check;

alter table public.generation_jobs
  alter column credit_cost set default 0;

alter table public.generation_jobs
  add column if not exists idempotency_key uuid;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_subject_count_check;

alter table public.generation_subjects
  drop constraint if exists generation_subjects_position_check;

create unique index if not exists generation_jobs_user_idempotency_idx
  on public.generation_jobs(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_generation_job_v2(
  p_user_id uuid,
  p_spec jsonb,
  p_skill_version text,
  p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_job_id uuid;
  v_subject jsonb;
  v_subject_id uuid;
  v_position integer := 0;
  v_subject_count integer;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then raise exception 'not authorized'; end if;
  if (select status from public.profiles where id = p_user_id) <> 'active' then raise exception 'account is not active'; end if;
  if coalesce(p_spec->>'settingsVersion', '') = '' then raise exception 'settings version is required'; end if;
  if jsonb_typeof(p_spec->'subjects') <> 'array' then raise exception 'subjects must be an array'; end if;

  v_subject_count := jsonb_array_length(p_spec->'subjects');
  if v_subject_count < 1 then raise exception 'at least one subject is required'; end if;

  select id into v_job_id from public.generation_jobs
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if v_job_id is not null then return v_job_id; end if;

  if exists (select 1 from public.generation_jobs where user_id = p_user_id and status in ('queued', 'processing')) then
    raise exception 'active generation exists';
  end if;

  insert into public.generation_jobs (
    user_id, description, skill_version, credit_cost, settings_version,
    generation_spec, subject_count, variants_per_subject, progress_phase, idempotency_key
  ) values (
    p_user_id, left(p_spec->'subjects'->0->>'description', 1000), p_skill_version, 0,
    p_spec->>'settingsVersion', p_spec, v_subject_count, 3, 'queued', p_idempotency_key
  ) returning id into v_job_id;

  for v_subject in select value from jsonb_array_elements(p_spec->'subjects') loop
    insert into public.generation_subjects (job_id, client_id, name, description, position, color_override)
    values (v_job_id, v_subject->>'clientId', v_subject->>'name', v_subject->>'description', v_position, v_subject->'colorOverride')
    returning id into v_subject_id;
    insert into public.generation_variants(subject_id, slot) values (v_subject_id, 1), (v_subject_id, 2), (v_subject_id, 3);
    v_position := v_position + 1;
  end loop;
  return v_job_id;
end;
$$;

revoke all on function public.create_generation_job_v2(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.create_generation_job_v2(uuid, jsonb, text, uuid) to authenticated, service_role;

create or replace function public.set_generation_primary_variant(p_subject_id uuid, p_variant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.generation_variants v
    join public.generation_subjects s on s.id = v.subject_id
    join public.generation_jobs j on j.id = s.job_id
    where v.id = p_variant_id and s.id = p_subject_id and v.status = 'completed' and j.user_id = auth.uid()
  ) then raise exception 'variant not available'; end if;
  update public.generation_variants set is_primary = false where subject_id = p_subject_id and is_primary;
  update public.generation_variants set is_primary = true where id = p_variant_id and subject_id = p_subject_id;
end;
$$;

revoke all on function public.set_generation_primary_variant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_generation_primary_variant(uuid, uuid) to authenticated, service_role;
