-- PRD 2.0 generation model: one job contains many subjects and each subject has 3 variants.

alter type public.generation_status add value if not exists 'partial';

alter table public.generation_jobs
  drop constraint if exists generation_jobs_description_check;

alter table public.generation_jobs
  add column settings_version text,
  add column pricing_version text,
  add column generation_spec jsonb,
  add column subject_count smallint check (subject_count between 1 and 20),
  add column variants_per_subject smallint not null default 3 check (variants_per_subject = 3),
  add column progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  add column progress_phase text not null default 'queued',
  add column refunded_credit_count integer not null default 0 check (refunded_credit_count >= 0),
  add column image_quality text,
  add column expires_at timestamptz;

create unique index generation_jobs_one_active_per_user_idx
  on public.generation_jobs(user_id)
  where status in ('queued', 'processing');

create table public.generation_subjects (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  client_id text not null,
  name text not null check (char_length(name) between 1 and 40),
  description text not null check (char_length(description) between 2 and 300),
  position smallint not null check (position between 0 and 19),
  color_override jsonb,
  status public.generation_status not null default 'queued',
  credit_refunded_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, client_id),
  unique (job_id, position)
);

create table public.generation_variants (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.generation_subjects(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  status public.generation_status not null default 'queued',
  is_primary boolean not null default false,
  prompt text,
  skill_name text,
  skill_version text,
  image_provider text,
  image_model text,
  image_quality text,
  provider_request_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, slot)
);

create unique index generation_variants_one_primary_per_subject_idx
  on public.generation_variants(subject_id)
  where is_primary;

create table public.generation_assets (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.generation_variants(id) on delete cascade,
  size smallint not null check (size in (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024)),
  width smallint not null check (width > 0),
  height smallint not null check (height > 0),
  has_alpha boolean not null,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (variant_id, size),
  unique (storage_bucket, storage_path)
);

create index generation_subjects_job_position_idx on public.generation_subjects(job_id, position);
create index generation_variants_subject_slot_idx on public.generation_variants(subject_id, slot);
create index generation_assets_variant_size_idx on public.generation_assets(variant_id, size);

create trigger generation_subjects_set_updated_at
  before update on public.generation_subjects
  for each row execute function public.set_updated_at();

create trigger generation_variants_set_updated_at
  before update on public.generation_variants
  for each row execute function public.set_updated_at();

alter table public.generation_subjects enable row level security;
alter table public.generation_variants enable row level security;
alter table public.generation_assets enable row level security;

create policy "users read own generation subjects"
  on public.generation_subjects for select using (
    exists (select 1 from public.generation_jobs j where j.id = job_id and j.user_id = auth.uid())
  );

create policy "users read own generation variants"
  on public.generation_variants for select using (
    exists (
      select 1 from public.generation_subjects s
      join public.generation_jobs j on j.id = s.job_id
      where s.id = subject_id and j.user_id = auth.uid()
    )
  );

create policy "users read own generation assets"
  on public.generation_assets for select using (
    exists (
      select 1 from public.generation_variants v
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      where v.id = variant_id and j.user_id = auth.uid()
    )
  );

create policy "users read v2 generated icon objects" on storage.objects for select using (
  bucket_id = 'generated-icons' and exists (
    select 1 from public.generation_assets a
    join public.generation_variants v on v.id = a.variant_id
    join public.generation_subjects s on s.id = v.subject_id
    join public.generation_jobs j on j.id = s.job_id
    where a.storage_bucket = bucket_id and a.storage_path = name and j.user_id = auth.uid()
  )
);

create or replace function public.create_generation_job_v2_and_debit(
  p_user_id uuid,
  p_spec jsonb,
  p_skill_version text,
  p_pricing_version text,
  p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
  v_credit_cost integer;
  v_job_id uuid;
  v_existing_job_id uuid;
  v_subject jsonb;
  v_subject_id uuid;
  v_position integer := 0;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if (select status from public.profiles where id = p_user_id) <> 'active' then
    raise exception 'account is not active';
  end if;
  if p_spec->>'settingsVersion' <> 'core-settings-2026-08-20.1' then
    raise exception 'settings version expired';
  end if;
  if jsonb_typeof(p_spec->'subjects') <> 'array' then raise exception 'subjects must be an array'; end if;

  v_credit_cost := jsonb_array_length(p_spec->'subjects');
  if v_credit_cost < 1 or v_credit_cost > 20 then raise exception 'subject count must be between 1 and 20'; end if;

  select generation_job_id into v_existing_job_id
  from public.credit_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key::text;
  if v_existing_job_id is not null then return v_existing_job_id; end if;

  if exists (
    select 1 from public.generation_jobs
    where user_id = p_user_id and status in ('queued', 'processing')
  ) then raise exception 'active generation exists'; end if;

  select balance into v_balance from public.credit_accounts
  where user_id = p_user_id for update;
  if v_balance is null then raise exception 'credit account not found'; end if;
  if v_balance < v_credit_cost then raise exception 'insufficient credits'; end if;

  insert into public.generation_jobs (
    user_id, description, skill_version, credit_cost, settings_version, pricing_version,
    generation_spec, subject_count, variants_per_subject, progress_phase
  ) values (
    p_user_id, left(p_spec->'subjects'->0->>'description', 1000), p_skill_version,
    v_credit_cost, p_spec->>'settingsVersion', p_pricing_version, p_spec,
    v_credit_cost, 3, 'queued'
  ) returning id into v_job_id;

  for v_subject in select value from jsonb_array_elements(p_spec->'subjects') loop
    insert into public.generation_subjects (
      job_id, client_id, name, description, position, color_override
    ) values (
      v_job_id, v_subject->>'clientId', v_subject->>'name', v_subject->>'description',
      v_position, v_subject->'colorOverride'
    ) returning id into v_subject_id;

    insert into public.generation_variants(subject_id, slot)
    values (v_subject_id, 1), (v_subject_id, 2), (v_subject_id, 3);
    v_position := v_position + 1;
  end loop;

  update public.credit_accounts set balance = balance - v_credit_cost, updated_at = now()
  where user_id = p_user_id returning balance into v_balance;

  insert into public.credit_ledger (
    user_id, entry_type, amount, balance_after, generation_job_id, idempotency_key
  ) values (
    p_user_id, 'generation_debit', -v_credit_cost, v_balance, v_job_id, p_idempotency_key::text
  );

  return v_job_id;
end;
$$;

revoke all on function public.create_generation_job_v2_and_debit(uuid, jsonb, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_generation_job_v2_and_debit(uuid, jsonb, text, text, uuid)
  to authenticated, service_role;

-- The v1 entrypoint creates one subject and four result rows. Keep the historical
-- tables readable during migration, but make the incompatible write path unusable.
revoke all on function public.create_generation_job_and_debit(uuid, text, text, text, integer, text)
  from authenticated, service_role;
revoke all on function public.complete_generation_job(uuid)
  from authenticated, service_role;
comment on table public.generation_results is
  'Legacy v1 four-result table; do not write new generation data here.';
