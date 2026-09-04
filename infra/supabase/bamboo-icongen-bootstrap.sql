-- Bamboo IconGen initial Supabase database setup
-- Generated from infra/supabase/migrations in filename order.
-- Run once on a new Supabase project using Dashboard -> SQL Editor.

-- ============================================================================
-- 0001_initial_schema.sql
-- ============================================================================

begin;

create extension if not exists pgcrypto;

create type public.generation_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.ledger_entry_type as enum ('purchase', 'generation_debit', 'generation_refund', 'admin_adjustment');
create type public.order_status as enum ('pending', 'paid', 'expired', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  description text not null check (char_length(description) between 10 and 1000),
  style_preset text,
  skill_version text not null,
  credit_cost integer not null check (credit_cost > 0),
  status public.generation_status not null default 'queued',
  attempt_count integer not null default 0,
  failure_refunded_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index generation_jobs_user_created_idx on public.generation_jobs(user_id, created_at desc);
create index generation_jobs_status_created_idx on public.generation_jobs(status, created_at);

create table public.generation_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  slot smallint not null check (slot between 1 and 4),
  storage_bucket text not null,
  storage_path text not null,
  prompt text not null,
  provider_request_id text,
  created_at timestamptz not null default now(),
  unique (job_id, slot),
  unique (storage_bucket, storage_path)
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_type public.ledger_entry_type not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null check (balance_after >= 0),
  generation_job_id uuid references public.generation_jobs(id) on delete restrict,
  order_id uuid,
  idempotency_key text not null unique,
  note text,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_created_idx on public.credit_ledger(user_id, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  price_id text not null,
  credits integer not null check (credits > 0),
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (char_length(currency) = 3),
  status public.order_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credit_ledger
  add constraint credit_ledger_order_fk foreign key (order_id) references public.orders(id) on delete restrict;

create table public.stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.credit_accounts (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_generation_job_and_debit(
  p_user_id uuid,
  p_description text,
  p_style_preset text,
  p_skill_version text,
  p_credit_cost integer,
  p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
  v_job_id uuid;
  v_existing_job_id uuid;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;
  if p_credit_cost <= 0 then raise exception 'invalid credit cost'; end if;

  select generation_job_id into v_existing_job_id
  from public.credit_ledger where idempotency_key = p_idempotency_key;
  if v_existing_job_id is not null then return v_existing_job_id; end if;

  select balance into v_balance from public.credit_accounts
  where user_id = p_user_id for update;
  if v_balance is null then raise exception 'credit account not found'; end if;
  if v_balance < p_credit_cost then raise exception 'insufficient credits'; end if;

  insert into public.generation_jobs
    (user_id, description, style_preset, skill_version, credit_cost)
  values
    (p_user_id, p_description, nullif(p_style_preset, ''), p_skill_version, p_credit_cost)
  returning id into v_job_id;

  update public.credit_accounts set balance = balance - p_credit_cost, updated_at = now()
  where user_id = p_user_id returning balance into v_balance;

  insert into public.credit_ledger
    (user_id, entry_type, amount, balance_after, generation_job_id, idempotency_key)
  values
    (p_user_id, 'generation_debit', -p_credit_cost, v_balance, v_job_id, p_idempotency_key);
  return v_job_id;
end;
$$;

create or replace function public.claim_generation_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.generation_jobs
  set status = 'processing', started_at = coalesce(started_at, now()),
      attempt_count = attempt_count + 1, updated_at = now()
  where id = p_job_id and status in ('queued', 'processing');
  if not found then raise exception 'job is not claimable'; end if;
end;
$$;

create or replace function public.complete_generation_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.generation_results where job_id = p_job_id) <> 4 then
    raise exception 'job must contain exactly four results';
  end if;
  update public.generation_jobs set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_job_id and status = 'processing';
  if not found then raise exception 'job is not processing'; end if;
end;
$$;

create or replace function public.fail_generation_job_and_refund(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.generation_jobs%rowtype;
  v_balance integer;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found'; end if;
  if v_job.status = 'completed' then raise exception 'completed job cannot fail'; end if;

  update public.generation_jobs
  set status = 'failed', error_code = p_error_code, error_message = p_error_message,
      failure_refunded_at = coalesce(failure_refunded_at, now()), updated_at = now()
  where id = p_job_id;

  if v_job.failure_refunded_at is null then
    update public.credit_accounts set balance = balance + v_job.credit_cost, updated_at = now()
    where user_id = v_job.user_id returning balance into v_balance;
    insert into public.credit_ledger
      (user_id, entry_type, amount, balance_after, generation_job_id, idempotency_key)
    values
      (v_job.user_id, 'generation_refund', v_job.credit_cost, v_balance, v_job.id,
       'generation-refund:' || v_job.id::text)
    on conflict (idempotency_key) do nothing;
  end if;
end;
$$;

create or replace function public.credit_paid_order(p_order_id uuid, p_stripe_event_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_balance integer;
begin
  insert into public.stripe_events(event_id, event_type)
  values (p_stripe_event_id, 'checkout.session.completed')
  on conflict do nothing;
  if not found then return; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if v_order.status = 'paid' then return; end if;
  update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
  where id = p_order_id;
  update public.credit_accounts set balance = balance + v_order.credits, updated_at = now()
  where user_id = v_order.user_id returning balance into v_balance;
  insert into public.credit_ledger
    (user_id, entry_type, amount, balance_after, order_id, idempotency_key)
  values
    (v_order.user_id, 'purchase', v_order.credits, v_balance, v_order.id,
     'stripe-event:' || p_stripe_event_id);
end;
$$;

alter table public.profiles enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generation_results enable row level security;
alter table public.orders enable row level security;
alter table public.stripe_events enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users read own credit account" on public.credit_accounts for select using (user_id = auth.uid());
create policy "users read own ledger" on public.credit_ledger for select using (user_id = auth.uid());
create policy "users read own jobs" on public.generation_jobs for select using (user_id = auth.uid());
create policy "users read own results" on public.generation_results for select using (
  exists (select 1 from public.generation_jobs j where j.id = job_id and j.user_id = auth.uid())
);
create policy "users read own orders" on public.orders for select using (user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('generated-icons', 'generated-icons', false)
on conflict (id) do update set public = false;

create policy "users read generated icon objects" on storage.objects for select using (
  bucket_id = 'generated-icons' and exists (
    select 1 from public.generation_results r
    join public.generation_jobs j on j.id = r.job_id
    where r.storage_bucket = bucket_id and r.storage_path = name and j.user_id = auth.uid()
  )
);

revoke all on function public.claim_generation_job(uuid) from public, anon, authenticated;
revoke all on function public.complete_generation_job(uuid) from public, anon, authenticated;
revoke all on function public.fail_generation_job_and_refund(uuid, text, text) from public, anon, authenticated;
revoke all on function public.credit_paid_order(uuid, text) from public, anon, authenticated;
revoke all on function public.create_generation_job_and_debit(uuid, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_generation_job_and_debit(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.create_generation_job_and_debit(uuid, text, text, text, integer, text) to service_role;
grant execute on function public.claim_generation_job(uuid) to service_role;
grant execute on function public.complete_generation_job(uuid) to service_role;
grant execute on function public.fail_generation_job_and_refund(uuid, text, text) to service_role;
grant execute on function public.credit_paid_order(uuid, text) to service_role;

commit;

-- ============================================================================
-- 0002_configurable_generation_runtime.sql
-- ============================================================================

begin;

alter table public.generation_jobs
  add column skill_name text,
  add column image_provider text,
  add column image_model text;

alter table public.generation_results
  add column skill_name text,
  add column skill_version text,
  add column image_provider text,
  add column image_model text;

drop function public.claim_generation_job(uuid);

create or replace function public.claim_generation_job(
  p_job_id uuid,
  p_skill_name text,
  p_skill_version text,
  p_image_provider text,
  p_image_model text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.generation_jobs
  set status = 'processing', started_at = coalesce(started_at, now()),
      attempt_count = attempt_count + 1, skill_name = p_skill_name,
      skill_version = p_skill_version, image_provider = p_image_provider,
      image_model = p_image_model, updated_at = now()
  where id = p_job_id and status in ('queued', 'processing');
  if not found then raise exception 'job is not claimable'; end if;
end;
$$;

revoke all on function public.claim_generation_job(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_generation_job(uuid, text, text, text, text)
  to service_role;

commit;

-- ============================================================================
-- 0003_user_auth_and_account.sql
-- ============================================================================

begin;

create type public.account_status as enum ('active', 'restricted', 'deletion_pending');
create type public.deletion_request_status as enum ('pending', 'processing', 'completed', 'cancelled', 'failed');

alter table public.profiles
  add column status public.account_status not null default 'active';

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status public.deletion_request_status not null default 'pending',
  idempotency_key uuid not null unique,
  requested_at timestamptz not null default now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger account_deletion_requests_set_updated_at
  before update on public.account_deletion_requests
  for each row execute function public.set_updated_at();

alter table public.account_deletion_requests enable row level security;

create policy "users read own deletion request"
  on public.account_deletion_requests for select
  using (user_id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create or replace function public.request_account_deletion(p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  select id into v_request_id
  from public.account_deletion_requests
  where user_id = v_user_id and idempotency_key = p_idempotency_key;
  if v_request_id is not null then return v_request_id; end if;

  if exists (
    select 1 from public.generation_jobs
    where user_id = v_user_id and status in ('queued', 'processing')
  ) then
    raise exception 'active generation exists';
  end if;

  insert into public.account_deletion_requests (user_id, idempotency_key)
  values (v_user_id, p_idempotency_key)
  returning id into v_request_id;

  update public.profiles set status = 'deletion_pending' where id = v_user_id;

  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (v_user_id, 'account_deletion_requested', 'user', v_user_id::text,
          jsonb_build_object('request_id', v_request_id));

  return v_request_id;
end;
$$;

revoke all on function public.request_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.request_account_deletion(uuid) to authenticated;
grant execute on function public.request_account_deletion(uuid) to service_role;

commit;

-- ============================================================================
-- 0004_batch_generation_v2.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0005_consistency_and_security_fixes.sql
-- ============================================================================

begin;

-- Security and state-consistency fixes discovered during the 2026-08-20 audit.

alter table public.account_deletion_requests
  add column if not exists scheduled_deletion_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create or replace function public.request_account_deletion(p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
  v_has_request boolean := false;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;

  select * into v_request from public.account_deletion_requests
  where user_id = v_user_id for update;

  v_has_request := found;

  if v_has_request and v_request.status in ('pending', 'processing') then
    return v_request.id;
  end if;

  if exists (
    select 1 from public.generation_jobs
    where user_id = v_user_id and status in ('queued', 'processing')
  ) then raise exception 'active generation exists'; end if;

  if v_has_request then
    update public.account_deletion_requests set
      status = 'pending', idempotency_key = p_idempotency_key,
      requested_at = now(), scheduled_deletion_at = now() + interval '30 days',
      cancelled_at = null, processing_started_at = null, completed_at = null,
      failure_reason = null
    where id = v_request.id returning * into v_request;
  else
    insert into public.account_deletion_requests (
      user_id, idempotency_key, scheduled_deletion_at
    ) values (
      v_user_id, p_idempotency_key, now() + interval '30 days'
    ) returning * into v_request;
  end if;

  update public.profiles set status = 'deletion_pending' where id = v_user_id;
  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id, metadata)
  values (v_user_id, 'account_deletion_requested', 'user', v_user_id::text,
          jsonb_build_object('request_id', v_request.id, 'scheduled_deletion_at', v_request.scheduled_deletion_at));
  return v_request.id;
end;
$$;

create or replace function public.cancel_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  update public.account_deletion_requests
  set status = 'cancelled', cancelled_at = now()
  where user_id = v_user_id and status = 'pending' and scheduled_deletion_at > now();
  if not found then raise exception 'deletion request is not cancellable'; end if;
  update public.profiles set status = 'active' where id = v_user_id and status = 'deletion_pending';
  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id)
  values (v_user_id, 'account_deletion_cancelled', 'user', v_user_id::text);
end;
$$;

revoke all on function public.cancel_account_deletion() from public, anon, authenticated;
grant execute on function public.cancel_account_deletion() to authenticated, service_role;

-- Complete only a fully delivered v2 job and keep subject aggregates consistent.
create or replace function public.complete_generation_job_v2(p_job_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.generation_subjects s
    where s.job_id = p_job_id and (
      select count(*) from public.generation_variants v
      where v.subject_id = s.id and v.status = 'completed'
    ) <> 3
  ) then raise exception 'job contains incomplete subjects'; end if;

  update public.generation_subjects set status = 'completed', error_code = null, error_message = null
  where job_id = p_job_id;
  update public.generation_jobs set
    status = 'completed', progress_percent = 100, progress_phase = 'completed',
    completed_at = now(), updated_at = now()
  where id = p_job_id and status = 'processing';
  if not found then raise exception 'job is not processing'; end if;
end;
$$;

-- Finalize a permanently failed attempt at subject granularity. Each incomplete
-- subject receives exactly one credit, while completed assets remain available.
create or replace function public.finalize_generation_job_v2_failure(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.generation_jobs%rowtype;
  v_subject record;
  v_completed integer;
  v_balance integer;
  v_refunds integer := 0;
  v_any_completed boolean := false;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found'; end if;
  if v_job.status in ('completed', 'partial', 'failed') then return; end if;

  for v_subject in select id from public.generation_subjects where job_id = p_job_id order by position loop
    select count(*) into v_completed from public.generation_variants
    where subject_id = v_subject.id and status = 'completed';
    if v_completed > 0 then v_any_completed := true; end if;
    if v_completed = 3 then
      update public.generation_subjects set status = 'completed' where id = v_subject.id;
    else
      update public.generation_variants set
        status = 'failed', error_code = p_error_code,
        error_message = left(p_error_message, 1000), updated_at = now()
      where subject_id = v_subject.id and status <> 'completed';
      update public.generation_subjects set
        status = case when v_completed > 0 then 'partial'::public.generation_status else 'failed'::public.generation_status end,
        credit_refunded_at = coalesce(credit_refunded_at, now()),
        error_code = p_error_code, error_message = left(p_error_message, 1000)
      where id = v_subject.id;

      update public.credit_accounts set balance = balance + 1, updated_at = now()
      where user_id = v_job.user_id
        and not exists (
          select 1 from public.credit_ledger
          where user_id = v_job.user_id and idempotency_key = 'generation-subject-refund:' || v_subject.id::text
        )
      returning balance into v_balance;
      if found then
        insert into public.credit_ledger (
          user_id, entry_type, amount, balance_after, generation_job_id, idempotency_key
        ) values (
          v_job.user_id, 'generation_refund', 1, v_balance, p_job_id,
          'generation-subject-refund:' || v_subject.id::text
        );
        v_refunds := v_refunds + 1;
      end if;
    end if;
  end loop;

  update public.generation_jobs set
    status = case when v_any_completed then 'partial'::public.generation_status else 'failed'::public.generation_status end,
    progress_percent = 100, progress_phase = 'completed',
    refunded_credit_count = refunded_credit_count + v_refunds,
    failure_refunded_at = case when v_refunds > 0 then now() else failure_refunded_at end,
    error_code = p_error_code, error_message = left(p_error_message, 1000),
    completed_at = now(), updated_at = now()
  where id = p_job_id;
end;
$$;

revoke all on function public.complete_generation_job_v2(uuid) from public, anon, authenticated;
revoke all on function public.finalize_generation_job_v2_failure(uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_generation_job_v2(uuid) to service_role;
grant execute on function public.finalize_generation_job_v2_failure(uuid, text, text) to service_role;

commit;

-- ============================================================================
-- 0006_signup_bonus_entry_type.sql
-- ============================================================================

begin;

-- Keep signup credits auditable instead of disguising them as an admin adjustment.
alter type public.ledger_entry_type add value if not exists 'signup_bonus';

commit;

-- ============================================================================
-- 0007_new_user_signup_bonus.sql
-- ============================================================================

begin;

-- New users receive exactly six non-expiring experience credits. The credit
-- account insert and ledger entry run in the auth user transaction, so either
-- both are committed or neither is committed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_account_created boolean := false;
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.credit_accounts (user_id, balance)
  values (new.id, 6)
  on conflict (user_id) do nothing;
  v_account_created := found;

  if v_account_created then
    insert into public.credit_ledger (
      user_id, entry_type, amount, balance_after, idempotency_key, note
    ) values (
      new.id, 'signup_bonus', 6, 6,
      'signup-bonus:' || new.id::text,
      'New user experience credits'
    ) on conflict (idempotency_key) do nothing;
  end if;

  return new;
end;
$$;

commit;

-- ============================================================================
-- 0008_generation_without_credit_coupling.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0009_generation_asset_roles.sql
-- ============================================================================

begin;

alter table public.generation_assets
  add column if not exists asset_role text not null default 'output'
  check (asset_role in ('source', 'preview', 'output'));

alter table public.generation_assets
  drop constraint if exists generation_assets_variant_id_size_key;

alter table public.generation_assets
  add constraint generation_assets_variant_role_size_key unique (variant_id, asset_role, size);

drop index if exists public.generation_assets_variant_size_idx;
create index generation_assets_variant_role_size_idx
  on public.generation_assets(variant_id, asset_role, size);

commit;

-- ============================================================================
-- 0010_generation_asset_role_size_constraint.sql
-- ============================================================================

begin;

alter table public.generation_assets
  drop constraint if exists generation_assets_size_check;

alter table public.generation_assets
  add constraint generation_assets_size_check check (
    (asset_role in ('source', 'preview') and size > 0)
    or
    (
      asset_role = 'output'
      and size in (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024)
    )
  );

commit;

-- ============================================================================
-- 0011_partial_job_status_guard.sql
-- ============================================================================

begin;

begin;

-- A job with at least one completed variant is partial rather than wholly failed.
-- This guard also corrects the result of older failure-finalization functions.
create or replace function public.guard_generation_job_partial_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'failed' and exists (
    select 1
    from public.generation_subjects s
    join public.generation_variants v on v.subject_id = s.id
    where s.job_id = new.id and v.status = 'completed'
  ) then
    new.status = 'partial';
  end if;
  return new;
end;
$$;

drop trigger if exists generation_jobs_guard_partial_status on public.generation_jobs;
create trigger generation_jobs_guard_partial_status
  before insert or update of status on public.generation_jobs
  for each row execute function public.guard_generation_job_partial_status();

commit;

commit;

-- ============================================================================
-- 0012_svg_output_assets.sql
-- ============================================================================

begin;

alter table public.generation_assets
  add column if not exists format text not null default 'png'
  check (format in ('png', 'svg'));

alter table public.generation_assets
  add column if not exists mime_type text not null default 'image/png';

alter table public.generation_assets
  drop constraint if exists generation_assets_variant_role_size_key;

alter table public.generation_assets
  add constraint generation_assets_variant_role_size_format_key
  unique (variant_id, asset_role, size, format);

alter table public.generation_assets
  drop constraint if exists generation_assets_size_check;

alter table public.generation_assets
  add constraint generation_assets_size_check check (
    (format = 'svg' and asset_role = 'output' and size > 0)
    or
    (format = 'png' and asset_role in ('source', 'preview') and size > 0)
    or
    (format = 'png' and asset_role = 'output' and size in (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024))
  );

create index if not exists generation_assets_variant_format_idx
  on public.generation_assets(variant_id, format, asset_role);

commit;

-- ============================================================================
-- 0013_preserve_variant_failure_diagnostics.sql
-- ============================================================================

begin;

-- Preserve per-variant quality diagnostics written by the Worker. The job-level
-- finalizer may close variants that never started, but must not overwrite a
-- variant that is already terminal with its own specific error.
create or replace function public.finalize_generation_job_v2_failure(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.generation_jobs%rowtype;
  v_subject record;
  v_completed integer;
  v_balance integer;
  v_refunds integer := 0;
  v_any_completed boolean := false;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found'; end if;
  if v_job.status in ('completed', 'partial', 'failed') then return; end if;

  for v_subject in select id from public.generation_subjects where job_id = p_job_id order by position loop
    select count(*) into v_completed from public.generation_variants
    where subject_id = v_subject.id and status = 'completed';
    if v_completed > 0 then v_any_completed := true; end if;
    if v_completed = 3 then
      update public.generation_subjects set status = 'completed' where id = v_subject.id;
    else
      update public.generation_variants set
        status = 'failed', error_code = p_error_code,
        error_message = left(p_error_message, 1000), updated_at = now()
      where subject_id = v_subject.id and status in ('queued', 'processing');
      update public.generation_subjects set
        status = case when v_completed > 0 then 'partial'::public.generation_status else 'failed'::public.generation_status end,
        credit_refunded_at = coalesce(credit_refunded_at, now()),
        error_code = p_error_code, error_message = left(p_error_message, 1000)
      where id = v_subject.id;

      update public.credit_accounts set balance = balance + 1, updated_at = now()
      where user_id = v_job.user_id
        and not exists (
          select 1 from public.credit_ledger
          where user_id = v_job.user_id and idempotency_key = 'generation-subject-refund:' || v_subject.id::text
        )
      returning balance into v_balance;
      if found then
        insert into public.credit_ledger (
          user_id, entry_type, amount, balance_after, generation_job_id, idempotency_key
        ) values (
          v_job.user_id, 'generation_refund', 1, v_balance, p_job_id,
          'generation-subject-refund:' || v_subject.id::text
        );
        v_refunds := v_refunds + 1;
      end if;
    end if;
  end loop;

  update public.generation_jobs set
    status = case when v_any_completed then 'partial'::public.generation_status else 'failed'::public.generation_status end,
    progress_percent = 100, progress_phase = 'completed',
    refunded_credit_count = refunded_credit_count + v_refunds,
    failure_refunded_at = case when v_refunds > 0 then now() else failure_refunded_at end,
    error_code = p_error_code, error_message = left(p_error_message, 1000),
    completed_at = now(), updated_at = now()
  where id = p_job_id;
end;
$$;

commit;

-- ============================================================================
-- 0014_variant_detail_edits.sql
-- ============================================================================

begin;

create table if not exists public.generation_variant_revisions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.generation_variants(id) on delete cascade,
  parent_revision_id uuid references public.generation_variant_revisions(id) on delete set null,
  revision_number integer not null check (revision_number > 0),
  instruction text not null check (char_length(trim(instruction)) between 5 and 500),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  source_bucket text,
  source_path text,
  preview_bucket text,
  preview_path text,
  assets jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  provider_request_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (variant_id, revision_number)
);

alter table public.generation_variants
  add column if not exists active_revision_id uuid
  references public.generation_variant_revisions(id) on delete set null;

create unique index if not exists generation_variant_revisions_one_active_edit
  on public.generation_variant_revisions(variant_id)
  where status in ('queued', 'processing');

create index if not exists generation_variant_revisions_variant_created_idx
  on public.generation_variant_revisions(variant_id, created_at desc);

alter table public.generation_variant_revisions enable row level security;

drop policy if exists generation_variant_revisions_select_own on public.generation_variant_revisions;
create policy generation_variant_revisions_select_own
  on public.generation_variant_revisions for select
  using (
    exists (
      select 1
      from public.generation_variants v
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      where v.id = generation_variant_revisions.variant_id
        and j.user_id = auth.uid()
    )
  );

commit;

-- ============================================================================
-- 0015_generation_job_list_indexes.sql
-- ============================================================================

begin;

-- Keep private icon-list pagination fast as an account accumulates jobs.
create index if not exists generation_jobs_user_status_created_idx
  on public.generation_jobs(user_id, status, created_at desc);

create index if not exists generation_jobs_user_purpose_created_idx
  on public.generation_jobs(user_id, (generation_spec->>'purpose'), created_at desc);

create index if not exists generation_jobs_user_style_created_idx
  on public.generation_jobs(user_id, ((generation_spec->'style')->>'preset'), created_at desc);

create index if not exists generation_jobs_user_structure_created_idx
  on public.generation_jobs(user_id, ((generation_spec->'style')->>'graphicStructure'), created_at desc);

commit;

-- ============================================================================
-- 0016_cd_key_ledger_entry_type.sql
-- ============================================================================

begin;

-- Keep CD-Key credits distinguishable from paid orders, signup gifts, and
-- manual operator adjustments in the immutable ledger.
alter type public.ledger_entry_type add value if not exists 'cd_key_redemption';

commit;

-- ============================================================================
-- 0017_cd_key_redemption.sql
-- ============================================================================

begin;

create table if not exists public.credit_redemption_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (char_length(code_hash) = 64),
  code_hint text not null,
  credits integer not null check (credits > 0),
  expires_at timestamptz,
  disabled_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete restrict,
  redeemed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  check ((redeemed_by is null) = (redeemed_at is null))
);

create index if not exists credit_redemption_codes_created_idx
  on public.credit_redemption_codes(created_at desc);

alter table public.credit_ledger
  add column if not exists redemption_code_id uuid
  references public.credit_redemption_codes(id) on delete restrict;

create unique index if not exists credit_ledger_redemption_code_unique_idx
  on public.credit_ledger(redemption_code_id)
  where redemption_code_id is not null;

alter table public.credit_redemption_codes enable row level security;

-- Codes are deliberately not readable by authenticated users. The only
-- public operation is the atomic redeem function below.
revoke all on public.credit_redemption_codes from anon, authenticated;

create or replace function public.create_credit_redemption_code(
  p_credits integer,
  p_expires_at timestamptz default null,
  p_note text default null
) returns table(generated_code text, granted_credits integer, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_normalized text;
  v_attempt integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception using message = 'CD_KEY_CREATE_FORBIDDEN';
  end if;
  if p_credits <= 0 then
    raise exception using message = 'INVALID_CD_KEY_CREDITS';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception using message = 'INVALID_CD_KEY_EXPIRY';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'BAM-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4)) || '-' ||
      upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4)) || '-' ||
      upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4)) || '-' ||
      upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4));
    v_normalized := upper(regexp_replace(v_code, '[^A-Za-z0-9]', '', 'g'));

    begin
      insert into public.credit_redemption_codes (
        code_hash, code_hint, credits, expires_at, note
      ) values (
        encode(digest(v_normalized, 'sha256'), 'hex'),
        right(v_normalized, 4),
        p_credits,
        p_expires_at,
        nullif(trim(p_note), '')
      );
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  return query select v_code, p_credits, p_expires_at;
end;
$$;

create or replace function public.redeem_credit_code(p_code text)
returns table(granted_credits integer, new_balance integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text;
  v_code public.credit_redemption_codes%rowtype;
  v_balance integer;
begin
  if v_user_id is null then
    raise exception using message = 'AUTH_REQUIRED';
  end if;

  v_normalized := upper(regexp_replace(coalesce(trim(p_code), ''), '[^A-Za-z0-9]', '', 'g'));
  if v_normalized !~ '^BAM[A-Z0-9]{16}$' then
    raise exception using message = 'INVALID_CD_KEY';
  end if;

  select * into v_code
  from public.credit_redemption_codes
  where code_hash = encode(digest(v_normalized, 'sha256'), 'hex')
  for update;

  if not found then raise exception using message = 'INVALID_CD_KEY'; end if;
  if v_code.disabled_at is not null then raise exception using message = 'CD_KEY_DISABLED'; end if;
  if v_code.redeemed_at is not null then raise exception using message = 'CD_KEY_ALREADY_REDEEMED'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception using message = 'CD_KEY_EXPIRED';
  end if;

  select balance into v_balance
  from public.credit_accounts
  where user_id = v_user_id
  for update;
  if not found then raise exception using message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;

  update public.credit_redemption_codes
  set redeemed_by = v_user_id, redeemed_at = now()
  where id = v_code.id;

  update public.credit_accounts
  set balance = balance + v_code.credits, updated_at = now()
  where user_id = v_user_id
  returning balance into v_balance;

  insert into public.credit_ledger (
    user_id, entry_type, amount, balance_after, redemption_code_id,
    idempotency_key, note
  ) values (
    v_user_id, 'cd_key_redemption', v_code.credits, v_balance, v_code.id,
    'cd-key:' || v_code.id::text,
    'CD-Key ending in ' || v_code.code_hint
  );

  return query select v_code.credits, v_balance;
end;
$$;

revoke all on function public.create_credit_redemption_code(integer, timestamptz, text) from public;
grant execute on function public.create_credit_redemption_code(integer, timestamptz, text) to service_role;
revoke all on function public.redeem_credit_code(text) from public;
grant execute on function public.redeem_credit_code(text) to authenticated, service_role;

commit;

-- ============================================================================
-- 0018_restore_generation_credit_debit.sql
-- ============================================================================

begin;

-- Reconnect generation task creation to the canonical credit account. One
-- subject costs one credit and always creates three variants. Idempotent
-- retries return the existing job before any balance mutation.
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
    user_id, description, skill_version, credit_cost, settings_version,
    generation_spec, subject_count, variants_per_subject, progress_phase, idempotency_key
  ) values (
    p_user_id, left(p_spec->'subjects'->0->>'description', 1000), p_skill_version,
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

  return v_job_id;
end;
$$;

revoke all on function public.create_generation_job_v2(uuid, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_generation_job_v2(uuid, jsonb, text, uuid)
  to authenticated, service_role;

commit;

-- ============================================================================
-- 0019_remove_persisted_generation_prompts.sql
-- ============================================================================

begin;

-- Compiled prompts are server-side implementation details. RLS isolates rows,
-- not sensitive columns, so prompts must not live in user-readable tables.
alter table public.generation_variants drop column if exists prompt;

-- Remove the equivalent field from the retired v1 result table as well.
alter table public.generation_results drop column if exists prompt;

commit;

-- ============================================================================
-- 0020_worker_task_leases.sql
-- ============================================================================

begin;

alter table public.generation_jobs
  add column if not exists worker_lease_owner text,
  add column if not exists worker_lease_expires_at timestamptz;

alter table public.generation_variant_revisions
  add column if not exists worker_lease_owner text,
  add column if not exists worker_lease_expires_at timestamptz;

create index if not exists generation_jobs_worker_claim_idx
  on public.generation_jobs(status, worker_lease_expires_at, created_at)
  where status in ('queued', 'processing');

create index if not exists generation_variant_revisions_worker_claim_idx
  on public.generation_variant_revisions(status, worker_lease_expires_at, created_at)
  where status in ('queued', 'processing');

create or replace function public.claim_next_worker_task(
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns table(task_type text, task_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'lease seconds must be between 30 and 900';
  end if;

  select r.id into v_id
  from public.generation_variant_revisions r
  where r.status in ('queued', 'processing')
    and (
      r.worker_lease_expires_at is null and r.status = 'queued'
      or r.worker_lease_expires_at <= now()
      or (
        r.worker_lease_expires_at is null
        and r.status = 'processing'
        and r.updated_at < now() - interval '5 minutes'
      )
    )
  order by r.created_at
  for update skip locked
  limit 1;

  if v_id is not null then
    update public.generation_variant_revisions
    set worker_lease_owner = p_worker_id,
        worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    where id = v_id;
    return query select 'edit'::text, v_id;
    return;
  end if;

  select j.id into v_id
  from public.generation_jobs j
  where j.status in ('queued', 'processing')
    and (
      j.worker_lease_expires_at is null and j.status = 'queued'
      or j.worker_lease_expires_at <= now()
      or (
        j.worker_lease_expires_at is null
        and j.status = 'processing'
        and j.updated_at < now() - interval '5 minutes'
      )
    )
  order by j.created_at
  for update skip locked
  limit 1;

  if v_id is not null then
    update public.generation_jobs
    set worker_lease_owner = p_worker_id,
        worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    where id = v_id;
    return query select 'job'::text, v_id;
  end if;
end;
$$;

revoke all on function public.claim_next_worker_task(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_next_worker_task(text, integer)
  to service_role;

commit;

-- ============================================================================
-- 0021_generation_cost_circuit_breaker.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0022_revision_storage_read_policy.sql
-- ============================================================================

begin;

drop policy if exists "users read own generated revision objects" on storage.objects;

create policy "users read own generated revision objects"
  on storage.objects for select
  using (
    bucket_id = 'generated-icons'
    and exists (
      select 1
      from public.generation_variant_revisions r
      join public.generation_variants v on v.id = r.variant_id
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(r.assets) = 'array' then r.assets else '[]'::jsonb end
      ) asset
      where j.user_id = auth.uid()
        and asset ->> 'storageBucket' = bucket_id
        and asset ->> 'storagePath' = name
    )
  );

commit;

-- ============================================================================
-- 0023_admin_operations_and_cd_key_batches.sql
-- ============================================================================

begin;

create table if not exists public.credit_redemption_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  credits_per_code integer not null check (credits_per_code between 1 and 10000),
  code_count integer not null check (code_count between 1 and 500),
  expires_at timestamptz,
  channel text check (channel is null or char_length(channel) <= 80),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  disabled_at timestamptz,
  disabled_by uuid references public.profiles(id) on delete restrict,
  disabled_reason text check (disabled_reason is null or char_length(disabled_reason) <= 500),
  created_at timestamptz not null default now()
);

alter table public.credit_redemption_codes
  add column if not exists batch_id uuid references public.credit_redemption_batches(id) on delete restrict,
  add column if not exists created_by uuid references public.profiles(id) on delete restrict,
  add column if not exists disabled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists disabled_reason text;

create index if not exists credit_redemption_codes_batch_idx
  on public.credit_redemption_codes(batch_id, created_at desc);

alter table public.credit_redemption_batches enable row level security;
revoke all on public.credit_redemption_batches from public, anon, authenticated;

create or replace function public.create_credit_redemption_batch(
  p_admin_user_id uuid,
  p_name text,
  p_credits integer,
  p_code_count integer,
  p_expires_at timestamptz default null,
  p_channel text default null,
  p_note text default null
) returns table(batch_id uuid, generated_code text, code_hint text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_batch_id uuid;
  v_code text;
  v_normalized text;
  v_position integer;
  v_attempt integer;
begin
  if auth.role() <> 'service_role' then raise exception using message = 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = p_admin_user_id and status = 'active') then
    raise exception using message = 'ADMIN_ACCOUNT_INVALID';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception using message = 'INVALID_BATCH_NAME'; end if;
  if p_credits not between 1 and 10000 then raise exception using message = 'INVALID_CD_KEY_CREDITS'; end if;
  if p_code_count not between 1 and 500 then raise exception using message = 'INVALID_CD_KEY_COUNT'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception using message = 'INVALID_CD_KEY_EXPIRY'; end if;

  insert into public.credit_redemption_batches(name, credits_per_code, code_count, expires_at, channel, note, created_by)
  values (trim(p_name), p_credits, p_code_count, p_expires_at, nullif(trim(p_channel), ''), nullif(trim(p_note), ''), p_admin_user_id)
  returning id into v_batch_id;

  for v_position in 1..p_code_count loop
    v_attempt := 0;
    loop
      v_attempt := v_attempt + 1;
      v_code := 'BAM-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4)) || '-' ||
        upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4)) || '-' ||
        upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4)) || '-' ||
        upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 4));
      v_normalized := upper(regexp_replace(v_code, '[^A-Za-z0-9]', '', 'g'));
      begin
        insert into public.credit_redemption_codes(code_hash, code_hint, credits, expires_at, note, batch_id, created_by)
        values (encode(digest(v_normalized, 'sha256'), 'hex'), right(v_normalized, 4), p_credits, p_expires_at,
          nullif(trim(p_note), ''), v_batch_id, p_admin_user_id);
        exit;
      exception when unique_violation then
        if v_attempt >= 5 then raise; end if;
      end;
    end loop;
    batch_id := v_batch_id;
    generated_code := v_code;
    code_hint := right(v_normalized, 4);
    return next;
  end loop;

  insert into public.admin_audit_logs(actor_user_id, action, target_type, target_id, metadata)
  values (p_admin_user_id, 'cd_key_batch_created', 'credit_redemption_batch', v_batch_id::text,
    jsonb_build_object('name', trim(p_name), 'credits_per_code', p_credits, 'code_count', p_code_count,
      'expires_at', p_expires_at, 'channel', nullif(trim(p_channel), '')));
end;
$$;

create or replace function public.disable_credit_redemption_batch(
  p_admin_user_id uuid,
  p_batch_id uuid,
  p_reason text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if auth.role() <> 'service_role' then raise exception using message = 'ADMIN_REQUIRED'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception using message = 'DISABLE_REASON_REQUIRED'; end if;
  update public.credit_redemption_batches set disabled_at = coalesce(disabled_at, now()), disabled_by = p_admin_user_id,
    disabled_reason = trim(p_reason) where id = p_batch_id and disabled_at is null;
  if not found then raise exception using message = 'BATCH_NOT_AVAILABLE'; end if;
  update public.credit_redemption_codes set disabled_at = coalesce(disabled_at, now()), disabled_by = p_admin_user_id,
    disabled_reason = trim(p_reason) where batch_id = p_batch_id and redeemed_at is null and disabled_at is null;
  get diagnostics v_count = row_count;
  insert into public.admin_audit_logs(actor_user_id, action, target_type, target_id, metadata)
  values (p_admin_user_id, 'cd_key_batch_disabled', 'credit_redemption_batch', p_batch_id::text,
    jsonb_build_object('disabled_codes', v_count, 'reason', trim(p_reason)));
  return v_count;
end;
$$;

revoke all on function public.create_credit_redemption_batch(uuid, text, integer, integer, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.disable_credit_redemption_batch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_credit_redemption_batch(uuid, text, integer, integer, timestamptz, text, text) to service_role;
grant execute on function public.disable_credit_redemption_batch(uuid, uuid, text) to service_role;

commit;

-- ============================================================================
-- 0024_partial_generation_billing_settlement.sql
-- ============================================================================

begin;

-- A subject costs one credit and promises three variants. A partially delivered
-- subject keeps its original charge while failed variants remain free to retry.
-- Only a subject with zero usable variants receives an automatic refund.
create or replace function public.finalize_generation_job_v2_failure(
  p_job_id uuid,
  p_error_code text,
  p_error_message text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_job public.generation_jobs%rowtype;
  v_subject record;
  v_completed integer;
  v_balance integer;
  v_refunds integer := 0;
  v_any_completed boolean := false;
begin
  select * into v_job from public.generation_jobs where id = p_job_id for update;
  if not found then raise exception 'job not found'; end if;
  if v_job.status in ('completed', 'partial', 'failed') then return; end if;

  for v_subject in
    select id from public.generation_subjects where job_id = p_job_id order by position
  loop
    select count(*) into v_completed
    from public.generation_variants
    where subject_id = v_subject.id and status = 'completed';

    if v_completed > 0 then v_any_completed := true; end if;
    if v_completed = 3 then
      update public.generation_subjects
      set status = 'completed', error_code = null, error_message = null
      where id = v_subject.id;
    else
      update public.generation_variants
      set status = 'failed', error_code = p_error_code,
          error_message = left(p_error_message, 1000), updated_at = now()
      where subject_id = v_subject.id and status in ('queued', 'processing');

      update public.generation_subjects
      set status = case
            when v_completed > 0 then 'partial'::public.generation_status
            else 'failed'::public.generation_status
          end,
          error_code = p_error_code,
          error_message = left(p_error_message, 1000),
          -- A partial result retains the original charge. A fully failed
          -- subject is refunded once and may still use the free retry path.
          credit_refunded_at = case
            when v_completed = 0 then coalesce(credit_refunded_at, now())
            else credit_refunded_at
          end
      where id = v_subject.id;

      if v_completed = 0 then
        update public.credit_accounts
        set balance = balance + 1, updated_at = now()
        where user_id = v_job.user_id
          and not exists (
            select 1 from public.credit_ledger
            where user_id = v_job.user_id
              and idempotency_key = 'generation-subject-refund:' || v_subject.id::text
          )
        returning balance into v_balance;

        if found then
          insert into public.credit_ledger (
            user_id, entry_type, amount, balance_after, generation_job_id,
            idempotency_key
          ) values (
            v_job.user_id, 'generation_refund', 1, v_balance, p_job_id,
            'generation-subject-refund:' || v_subject.id::text
          );
          v_refunds := v_refunds + 1;
        end if;
      end if;
    end if;
  end loop;

  update public.generation_jobs
  set status = case
        when v_any_completed then 'partial'::public.generation_status
        else 'failed'::public.generation_status
      end,
      progress_percent = 100,
      progress_phase = 'completed',
      refunded_credit_count = refunded_credit_count + v_refunds,
      failure_refunded_at = case
        when v_refunds > 0 then now()
        else failure_refunded_at
      end,
      error_code = p_error_code,
      error_message = left(p_error_message, 1000),
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;
end;
$$;

-- Restarting a failed variant must be one atomic state transition. This avoids
-- a queued variant being paired with a terminal subject or job if one of the
-- former three independent updates fails halfway through.
create or replace function public.retry_generation_variant_v2(
  p_user_id uuid,
  p_variant_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_variant public.generation_variants%rowtype;
  v_subject public.generation_subjects%rowtype;
  v_job public.generation_jobs%rowtype;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception using message = 'NOT_AUTHORIZED';
  end if;

  select * into v_variant
  from public.generation_variants
  where id = p_variant_id
  for update;
  if not found then raise exception using message = 'GENERATION_VARIANT_NOT_FOUND'; end if;

  select * into v_subject
  from public.generation_subjects
  where id = v_variant.subject_id
  for update;

  select * into v_job
  from public.generation_jobs
  where id = v_subject.job_id
  for update;

  if v_job.user_id <> p_user_id then
    raise exception using message = 'GENERATION_VARIANT_NOT_FOUND';
  end if;
  if v_variant.status <> 'failed' then
    raise exception using message = 'VARIANT_NOT_FAILED';
  end if;

  update public.generation_variants
  set status = 'queued', started_at = null, completed_at = null,
      error_code = null, error_message = null, updated_at = now()
  where id = p_variant_id;

  update public.generation_subjects
  set status = 'processing', error_code = null, error_message = null,
      updated_at = now()
  where id = v_subject.id;

  update public.generation_jobs
  set status = 'queued', progress_phase = 'queued', completed_at = null,
      error_code = null, error_message = null, updated_at = now()
  where id = v_job.id;

  return v_job.id;
end;
$$;

revoke all on function public.retry_generation_variant_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retry_generation_variant_v2(uuid, uuid)
  to service_role;

commit;

-- ============================================================================
-- 0025_paid_variant_detail_edits.sql
-- ============================================================================

begin;

-- Each variant includes three successful detail edits. Later edits cost one
-- credit. Creation, charging, and ledger insertion are one transaction;
-- provider failures are refunded exactly once by the settlement function.
alter table public.generation_variant_revisions
  add column if not exists idempotency_key uuid,
  add column if not exists credit_charged_at timestamptz,
  add column if not exists credit_refunded_at timestamptz;

create unique index if not exists generation_variant_revisions_idempotency_idx
  on public.generation_variant_revisions(variant_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_variant_detail_edit_v2(
  p_user_id uuid,
  p_variant_id uuid,
  p_instruction text,
  p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_variant public.generation_variants%rowtype;
  v_job_id uuid;
  v_owner_id uuid;
  v_revision_id uuid;
  v_revision_number integer;
  v_used integer;
  v_balance integer;
  v_charge integer;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception using message = 'NOT_AUTHORIZED';
  end if;
  if char_length(trim(p_instruction)) < 5 or char_length(trim(p_instruction)) > 500 then
    raise exception using message = 'INVALID_VARIANT_EDIT';
  end if;

  select * into v_variant from public.generation_variants
  where id = p_variant_id for update;
  if not found or v_variant.status <> 'completed' then
    raise exception using message = 'VARIANT_NOT_EDITABLE';
  end if;

  select j.id, j.user_id into v_job_id, v_owner_id
  from public.generation_subjects s
  join public.generation_jobs j on j.id = s.job_id
  where s.id = v_variant.subject_id;
  if v_owner_id <> p_user_id then
    raise exception using message = 'GENERATION_VARIANT_NOT_FOUND';
  end if;

  select id into v_revision_id from public.generation_variant_revisions
  where variant_id = p_variant_id and idempotency_key = p_idempotency_key;
  if v_revision_id is not null then
    select revision_number into v_revision_number
    from public.generation_variant_revisions where id = v_revision_id;
    select count(*) into v_used from public.generation_variant_revisions
    where variant_id = p_variant_id
      and (status = 'completed' or error_code = 'VARIANT_EDIT_DISCARDED');
    return jsonb_build_object(
      'id', v_revision_id,
      'revisionNumber', v_revision_number,
      'status', (select status from public.generation_variant_revisions where id = v_revision_id),
      'remainingDetailEdits', greatest(0, 3 - v_used),
      'chargedCredits', case when (select credit_charged_at from public.generation_variant_revisions where id = v_revision_id) is null then 0 else 1 end
    );
  end if;

  if exists (select 1 from public.generation_variant_revisions
    where variant_id = p_variant_id and status in ('queued', 'processing')) then
    raise exception using message = 'VARIANT_EDIT_IN_PROGRESS';
  end if;

  select count(*) into v_used from public.generation_variant_revisions
  where variant_id = p_variant_id
    and (status = 'completed' or error_code = 'VARIANT_EDIT_DISCARDED');
  v_charge := case when v_used >= 3 then 1 else 0 end;

  if v_charge = 1 then
    select balance into v_balance from public.credit_accounts
    where user_id = p_user_id for update;
    if not found then raise exception using message = 'CREDIT_ACCOUNT_NOT_FOUND'; end if;
    if v_balance < 1 then
      raise exception using message = 'INSUFFICIENT_CREDITS', detail = jsonb_build_object('required', 1, 'balance', v_balance)::text;
    end if;
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_revision_number
  from public.generation_variant_revisions where variant_id = p_variant_id;
  insert into public.generation_variant_revisions (
    variant_id, parent_revision_id, revision_number, instruction, status,
    idempotency_key, credit_charged_at
  ) values (
    p_variant_id, v_variant.active_revision_id, v_revision_number,
    trim(p_instruction), 'queued', p_idempotency_key,
    case when v_charge = 1 then now() else null end
  ) returning id into v_revision_id;

  if v_charge = 1 then
    update public.credit_accounts set balance = balance - 1, updated_at = now()
    where user_id = p_user_id returning balance into v_balance;
    insert into public.credit_ledger (
      user_id, entry_type, amount, balance_after, generation_job_id,
      idempotency_key, note
    ) values (
      p_user_id, 'generation_debit', -1, v_balance, v_job_id,
      'variant-edit-debit:' || v_revision_id::text,
      'Paid detail adjustment for variant ' || p_variant_id::text
    );
  end if;

  return jsonb_build_object(
    'id', v_revision_id, 'revisionNumber', v_revision_number,
    'status', 'queued', 'remainingDetailEdits', greatest(0, 2 - v_used),
    'chargedCredits', v_charge
  );
end;
$$;

create or replace function public.refund_failed_variant_detail_edit_v2(
  p_revision_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_revision public.generation_variant_revisions%rowtype;
  v_user_id uuid;
  v_job_id uuid;
  v_balance integer;
begin
  if auth.role() <> 'service_role' then raise exception using message = 'NOT_AUTHORIZED'; end if;
  select * into v_revision from public.generation_variant_revisions
  where id = p_revision_id for update;
  if not found or v_revision.credit_charged_at is null or v_revision.credit_refunded_at is not null then
    return false;
  end if;
  if v_revision.status <> 'failed' then return false; end if;

  select j.user_id, j.id into v_user_id, v_job_id
  from public.generation_variants v
  join public.generation_subjects s on s.id = v.subject_id
  join public.generation_jobs j on j.id = s.job_id
  where v.id = v_revision.variant_id;
  update public.credit_accounts set balance = balance + 1, updated_at = now()
  where user_id = v_user_id returning balance into v_balance;
  insert into public.credit_ledger (
    user_id, entry_type, amount, balance_after, generation_job_id,
    idempotency_key, note
  ) values (
    v_user_id, 'generation_refund', 1, v_balance, v_job_id,
    'variant-edit-refund:' || p_revision_id::text,
    'Refund for failed paid detail adjustment'
  );
  update public.generation_variant_revisions set credit_refunded_at = now(), updated_at = now()
  where id = p_revision_id and credit_refunded_at is null;
  return true;
end;
$$;

revoke all on function public.create_variant_detail_edit_v2(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_variant_detail_edit_v2(uuid, uuid, text, uuid) to service_role;
revoke all on function public.refund_failed_variant_detail_edit_v2(uuid) from public, anon, authenticated;
grant execute on function public.refund_failed_variant_detail_edit_v2(uuid) to service_role;

commit;

-- ============================================================================
-- 0026_remove_account_deletion.sql
-- ============================================================================

begin;

-- Account deletion is no longer part of the product. Existing pending states
-- are safely returned to active before the obsolete workflow is removed.
update public.profiles set status = 'active' where status = 'deletion_pending';

drop function if exists public.request_account_deletion(uuid);
drop function if exists public.cancel_account_deletion();
drop table if exists public.account_deletion_requests;
drop type if exists public.deletion_request_status;

alter table public.profiles alter column status drop default;
create type public.account_status_current as enum ('active', 'restricted');
alter table public.profiles alter column status type public.account_status_current
  using status::text::public.account_status_current;
drop type public.account_status;
alter type public.account_status_current rename to account_status;
alter table public.profiles alter column status set default 'active';

commit;
