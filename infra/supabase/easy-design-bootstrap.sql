-- EASY DESIGN / ICON GEN initial Supabase database setup
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

-- ============================================================================
-- 0027_generation_job_list_rpc.sql
-- ============================================================================

begin;

-- Collapse the icon-library job/subject/variant/asset reads into one database
-- round trip. The function is security-invoker and always scopes to auth.uid().
create or replace function public.list_generation_jobs_v1(
  p_page integer default 1,
  p_page_size integer default 12,
  p_usage text default 'interaction',
  p_style text default null,
  p_structure text default null,
  p_status text default null
) returns table (
  id uuid,
  status text,
  created_at timestamptz,
  generation_spec jsonb,
  total_count bigint,
  subjects jsonb,
  preview_assets jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select j.*
    from public.generation_jobs j
    where j.user_id = auth.uid()
      and j.id not in (
        '11111111-1111-4111-8111-111111111111'::uuid,
        '22222222-2222-4222-8222-222222222222'::uuid
      )
      and (p_usage <> 'interaction' or j.generation_spec->>'purpose' = 'interaction')
      and (p_usage <> 'illustration' or j.generation_spec->>'purpose' = 'app-icon')
      and (p_style is null or j.generation_spec->'style'->>'preset' = p_style)
      and (p_structure is null or j.generation_spec->'style'->>'graphicStructure' = p_structure)
      and (
        p_status is null
        or (p_status = 'in-progress' and j.status in ('queued', 'processing'))
        or (p_status <> 'in-progress' and j.status::text = p_status)
      )
  ), paged as (
    select f.*
    from filtered f
    order by f.created_at desc
    limit greatest(1, least(48, p_page_size))
    offset (greatest(1, p_page) - 1) * greatest(1, least(48, p_page_size))
  )
  select
    p.id,
    p.status::text,
    p.created_at,
    p.generation_spec,
    (select count(*) from filtered),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'position', s.position) order by s.position)
      from public.generation_subjects s where s.job_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', picked.id,
        'variant_id', picked.variant_id,
        'asset_role', picked.asset_role,
        'size', picked.size,
        'storage_bucket', picked.storage_bucket,
        'storage_path', picked.storage_path
      ) order by picked.subject_position, picked.slot)
      from (
        select preferred.* from (
          select distinct on (v.id)
            a.id, a.variant_id, a.asset_role, a.size, a.storage_bucket, a.storage_path,
            s.position as subject_position, v.slot
          from public.generation_subjects s
          join public.generation_variants v on v.subject_id = s.id and v.status = 'completed'
          join public.generation_assets a on a.variant_id = v.id and a.format = 'png'
          where s.job_id = p.id
          order by v.id,
            case a.asset_role when 'preview' then 0 when 'source' then 1 when 'output' then 2 else 9 end,
            case when a.size <= 256 then 0 else 1 end,
            case when a.size <= 256 then -a.size else a.size end
        ) preferred
        order by preferred.subject_position, preferred.slot
        limit 3
      ) picked
    ), '[]'::jsonb)
  from paged p
  order by p.created_at desc;
$$;

revoke all on function public.list_generation_jobs_v1(integer, integer, text, text, text, text) from public;
grant execute on function public.list_generation_jobs_v1(integer, integer, text, text, text, text) to authenticated, service_role;

commit;

-- ============================================================================
-- 0028_generation_favorites.sql
-- ============================================================================

begin;

create table if not exists public.generation_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  variant_id uuid not null references public.generation_variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create index if not exists generation_favorites_user_created_idx
  on public.generation_favorites(user_id, created_at desc);

alter table public.generation_favorites enable row level security;

drop policy if exists generation_favorites_select_own on public.generation_favorites;
drop policy if exists generation_favorites_insert_own on public.generation_favorites;
drop policy if exists generation_favorites_delete_own on public.generation_favorites;

create policy generation_favorites_select_own
  on public.generation_favorites for select
  using (auth.uid() = user_id);

create policy generation_favorites_insert_own
  on public.generation_favorites for insert
  with check (
    auth.uid() = user_id and exists (
      select 1
      from public.generation_variants v
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      where v.id = variant_id and v.status = 'completed' and j.user_id = auth.uid()
    )
  );

create policy generation_favorites_delete_own
  on public.generation_favorites for delete
  using (auth.uid() = user_id);

commit;

-- ============================================================================
-- 0029_library_favorites.sql
-- ============================================================================

begin;

-- Versioned development-sample registry. This does not certify production assets.
begin;
create table if not exists public.library_assets (
  id text primary key,
  design_id text not null,
  style text not null check (style in ('linear','outline','bold','broken','bulk','twotone')),
  version text not null,
  status text not null default 'development-sample',
  available boolean not null default true,
  unique(design_id,style,version)
);
create table if not exists public.library_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null references public.library_assets(id),
  created_at timestamptz not null default now(),
  primary key(user_id,asset_id)
);
create index if not exists library_favorites_user_created_idx on public.library_favorites(user_id,created_at desc);
alter table public.library_assets enable row level security;
alter table public.library_favorites enable row level security;
revoke all on public.library_assets, public.library_favorites from anon;
grant select on public.library_assets to authenticated;
grant select,insert,delete on public.library_favorites to authenticated;
create policy library_assets_read on public.library_assets for select to authenticated using(available);
create policy library_favorites_read on public.library_favorites for select to authenticated using(auth.uid()=user_id);
create policy library_favorites_add on public.library_favorites for insert to authenticated with check(
  auth.uid()=user_id and exists(select 1 from public.library_assets a where a.id=asset_id and a.available)
);
create policy library_favorites_remove on public.library_favorites for delete to authenticated using(auth.uid()=user_id);
-- Registry seed appended below before commit.
insert into public.library_assets(id,design_id,style,version) values
('essential-sample-1:linear:b997df861a78','essential-sample-1','linear','b997df861a78'),
('essential-sample-1:outline:b997df861a78','essential-sample-1','outline','b997df861a78'),
('essential-sample-1:bold:b997df861a78','essential-sample-1','bold','b997df861a78'),
('essential-sample-1:broken:b997df861a78','essential-sample-1','broken','b997df861a78'),
('essential-sample-1:bulk:b997df861a78','essential-sample-1','bulk','b997df861a78'),
('essential-sample-1:twotone:b997df861a78','essential-sample-1','twotone','b997df861a78'),
('essential-sample-2:linear:73069cd713b9','essential-sample-2','linear','73069cd713b9'),
('essential-sample-2:outline:73069cd713b9','essential-sample-2','outline','73069cd713b9'),
('essential-sample-2:bold:73069cd713b9','essential-sample-2','bold','73069cd713b9'),
('essential-sample-2:broken:73069cd713b9','essential-sample-2','broken','73069cd713b9'),
('essential-sample-2:bulk:73069cd713b9','essential-sample-2','bulk','73069cd713b9'),
('essential-sample-2:twotone:73069cd713b9','essential-sample-2','twotone','73069cd713b9'),
('essential-sample-3:linear:0a37f8e798be','essential-sample-3','linear','0a37f8e798be'),
('essential-sample-3:outline:0a37f8e798be','essential-sample-3','outline','0a37f8e798be'),
('essential-sample-3:bold:0a37f8e798be','essential-sample-3','bold','0a37f8e798be'),
('essential-sample-3:broken:0a37f8e798be','essential-sample-3','broken','0a37f8e798be'),
('essential-sample-3:bulk:0a37f8e798be','essential-sample-3','bulk','0a37f8e798be'),
('essential-sample-3:twotone:0a37f8e798be','essential-sample-3','twotone','0a37f8e798be'),
('files-sample-1:linear:d3a25c690d88','files-sample-1','linear','d3a25c690d88'),
('files-sample-1:outline:d3a25c690d88','files-sample-1','outline','d3a25c690d88'),
('files-sample-1:bold:d3a25c690d88','files-sample-1','bold','d3a25c690d88'),
('files-sample-1:broken:d3a25c690d88','files-sample-1','broken','d3a25c690d88'),
('files-sample-1:bulk:d3a25c690d88','files-sample-1','bulk','d3a25c690d88'),
('files-sample-1:twotone:d3a25c690d88','files-sample-1','twotone','d3a25c690d88'),
('files-sample-2:linear:dd9f9357074a','files-sample-2','linear','dd9f9357074a'),
('files-sample-2:outline:dd9f9357074a','files-sample-2','outline','dd9f9357074a'),
('files-sample-2:bold:dd9f9357074a','files-sample-2','bold','dd9f9357074a'),
('files-sample-2:broken:dd9f9357074a','files-sample-2','broken','dd9f9357074a'),
('files-sample-2:bulk:dd9f9357074a','files-sample-2','bulk','dd9f9357074a'),
('files-sample-2:twotone:dd9f9357074a','files-sample-2','twotone','dd9f9357074a'),
('files-sample-3:linear:38921090775e','files-sample-3','linear','38921090775e'),
('files-sample-3:outline:38921090775e','files-sample-3','outline','38921090775e'),
('files-sample-3:bold:38921090775e','files-sample-3','bold','38921090775e'),
('files-sample-3:broken:38921090775e','files-sample-3','broken','38921090775e'),
('files-sample-3:bulk:38921090775e','files-sample-3','bulk','38921090775e'),
('files-sample-3:twotone:38921090775e','files-sample-3','twotone','38921090775e'),
('emoji-sample-1:linear:7f7faf600989','emoji-sample-1','linear','7f7faf600989'),
('emoji-sample-1:outline:7f7faf600989','emoji-sample-1','outline','7f7faf600989'),
('emoji-sample-1:bold:7f7faf600989','emoji-sample-1','bold','7f7faf600989'),
('emoji-sample-1:broken:7f7faf600989','emoji-sample-1','broken','7f7faf600989'),
('emoji-sample-1:bulk:7f7faf600989','emoji-sample-1','bulk','7f7faf600989'),
('emoji-sample-1:twotone:7f7faf600989','emoji-sample-1','twotone','7f7faf600989'),
('emoji-sample-2:linear:319ec268ced4','emoji-sample-2','linear','319ec268ced4'),
('emoji-sample-2:outline:319ec268ced4','emoji-sample-2','outline','319ec268ced4'),
('emoji-sample-2:bold:319ec268ced4','emoji-sample-2','bold','319ec268ced4'),
('emoji-sample-2:broken:319ec268ced4','emoji-sample-2','broken','319ec268ced4'),
('emoji-sample-2:bulk:319ec268ced4','emoji-sample-2','bulk','319ec268ced4'),
('emoji-sample-2:twotone:319ec268ced4','emoji-sample-2','twotone','319ec268ced4'),
('emoji-sample-3:linear:aa6e35f389aa','emoji-sample-3','linear','aa6e35f389aa'),
('emoji-sample-3:outline:aa6e35f389aa','emoji-sample-3','outline','aa6e35f389aa'),
('emoji-sample-3:bold:aa6e35f389aa','emoji-sample-3','bold','aa6e35f389aa'),
('emoji-sample-3:broken:aa6e35f389aa','emoji-sample-3','broken','aa6e35f389aa'),
('emoji-sample-3:bulk:aa6e35f389aa','emoji-sample-3','bulk','aa6e35f389aa'),
('emoji-sample-3:twotone:aa6e35f389aa','emoji-sample-3','twotone','aa6e35f389aa'),
('time-sample-1:linear:d23205648ee3','time-sample-1','linear','d23205648ee3'),
('time-sample-1:outline:d23205648ee3','time-sample-1','outline','d23205648ee3'),
('time-sample-1:bold:d23205648ee3','time-sample-1','bold','d23205648ee3'),
('time-sample-1:broken:d23205648ee3','time-sample-1','broken','d23205648ee3'),
('time-sample-1:bulk:d23205648ee3','time-sample-1','bulk','d23205648ee3'),
('time-sample-1:twotone:d23205648ee3','time-sample-1','twotone','d23205648ee3'),
('time-sample-2:linear:187c586f10bb','time-sample-2','linear','187c586f10bb'),
('time-sample-2:outline:187c586f10bb','time-sample-2','outline','187c586f10bb'),
('time-sample-2:bold:187c586f10bb','time-sample-2','bold','187c586f10bb'),
('time-sample-2:broken:187c586f10bb','time-sample-2','broken','187c586f10bb'),
('time-sample-2:bulk:187c586f10bb','time-sample-2','bulk','187c586f10bb'),
('time-sample-2:twotone:187c586f10bb','time-sample-2','twotone','187c586f10bb'),
('time-sample-3:linear:931fcc00e478','time-sample-3','linear','931fcc00e478'),
('time-sample-3:outline:931fcc00e478','time-sample-3','outline','931fcc00e478'),
('time-sample-3:bold:931fcc00e478','time-sample-3','bold','931fcc00e478'),
('time-sample-3:broken:931fcc00e478','time-sample-3','broken','931fcc00e478'),
('time-sample-3:bulk:931fcc00e478','time-sample-3','bulk','931fcc00e478'),
('time-sample-3:twotone:931fcc00e478','time-sample-3','twotone','931fcc00e478'),
('weather-sample-1:linear:d6aff14bbdf3','weather-sample-1','linear','d6aff14bbdf3'),
('weather-sample-1:outline:d6aff14bbdf3','weather-sample-1','outline','d6aff14bbdf3'),
('weather-sample-1:bold:d6aff14bbdf3','weather-sample-1','bold','d6aff14bbdf3'),
('weather-sample-1:broken:d6aff14bbdf3','weather-sample-1','broken','d6aff14bbdf3'),
('weather-sample-1:bulk:d6aff14bbdf3','weather-sample-1','bulk','d6aff14bbdf3'),
('weather-sample-1:twotone:d6aff14bbdf3','weather-sample-1','twotone','d6aff14bbdf3'),
('weather-sample-2:linear:ebb6018cdd12','weather-sample-2','linear','ebb6018cdd12'),
('weather-sample-2:outline:ebb6018cdd12','weather-sample-2','outline','ebb6018cdd12'),
('weather-sample-2:bold:ebb6018cdd12','weather-sample-2','bold','ebb6018cdd12'),
('weather-sample-2:broken:ebb6018cdd12','weather-sample-2','broken','ebb6018cdd12'),
('weather-sample-2:bulk:ebb6018cdd12','weather-sample-2','bulk','ebb6018cdd12'),
('weather-sample-2:twotone:ebb6018cdd12','weather-sample-2','twotone','ebb6018cdd12'),
('weather-sample-3:linear:c47614321184','weather-sample-3','linear','c47614321184'),
('weather-sample-3:outline:c47614321184','weather-sample-3','outline','c47614321184'),
('weather-sample-3:bold:c47614321184','weather-sample-3','bold','c47614321184'),
('weather-sample-3:broken:c47614321184','weather-sample-3','broken','c47614321184'),
('weather-sample-3:bulk:c47614321184','weather-sample-3','bulk','c47614321184'),
('weather-sample-3:twotone:c47614321184','weather-sample-3','twotone','c47614321184'),
('food-sample-1:linear:094754141f5b','food-sample-1','linear','094754141f5b'),
('food-sample-1:outline:094754141f5b','food-sample-1','outline','094754141f5b'),
('food-sample-1:bold:094754141f5b','food-sample-1','bold','094754141f5b'),
('food-sample-1:broken:094754141f5b','food-sample-1','broken','094754141f5b'),
('food-sample-1:bulk:094754141f5b','food-sample-1','bulk','094754141f5b'),
('food-sample-1:twotone:094754141f5b','food-sample-1','twotone','094754141f5b'),
('food-sample-2:linear:7a18e81dcef5','food-sample-2','linear','7a18e81dcef5'),
('food-sample-2:outline:7a18e81dcef5','food-sample-2','outline','7a18e81dcef5'),
('food-sample-2:bold:7a18e81dcef5','food-sample-2','bold','7a18e81dcef5'),
('food-sample-2:broken:7a18e81dcef5','food-sample-2','broken','7a18e81dcef5'),
('food-sample-2:bulk:7a18e81dcef5','food-sample-2','bulk','7a18e81dcef5'),
('food-sample-2:twotone:7a18e81dcef5','food-sample-2','twotone','7a18e81dcef5'),
('food-sample-3:linear:fd79f6242b4c','food-sample-3','linear','fd79f6242b4c'),
('food-sample-3:outline:fd79f6242b4c','food-sample-3','outline','fd79f6242b4c'),
('food-sample-3:bold:fd79f6242b4c','food-sample-3','bold','fd79f6242b4c'),
('food-sample-3:broken:fd79f6242b4c','food-sample-3','broken','fd79f6242b4c'),
('food-sample-3:bulk:fd79f6242b4c','food-sample-3','bulk','fd79f6242b4c'),
('food-sample-3:twotone:fd79f6242b4c','food-sample-3','twotone','fd79f6242b4c'),
('energy-sample-1:linear:1a5f637adac5','energy-sample-1','linear','1a5f637adac5'),
('energy-sample-1:outline:1a5f637adac5','energy-sample-1','outline','1a5f637adac5'),
('energy-sample-1:bold:1a5f637adac5','energy-sample-1','bold','1a5f637adac5'),
('energy-sample-1:broken:1a5f637adac5','energy-sample-1','broken','1a5f637adac5'),
('energy-sample-1:bulk:1a5f637adac5','energy-sample-1','bulk','1a5f637adac5'),
('energy-sample-1:twotone:1a5f637adac5','energy-sample-1','twotone','1a5f637adac5'),
('energy-sample-2:linear:b5b39c74d110','energy-sample-2','linear','b5b39c74d110'),
('energy-sample-2:outline:b5b39c74d110','energy-sample-2','outline','b5b39c74d110'),
('energy-sample-2:bold:b5b39c74d110','energy-sample-2','bold','b5b39c74d110'),
('energy-sample-2:broken:b5b39c74d110','energy-sample-2','broken','b5b39c74d110'),
('energy-sample-2:bulk:b5b39c74d110','energy-sample-2','bulk','b5b39c74d110'),
('energy-sample-2:twotone:b5b39c74d110','energy-sample-2','twotone','b5b39c74d110'),
('energy-sample-3:linear:ad9a323f8836','energy-sample-3','linear','ad9a323f8836'),
('energy-sample-3:outline:ad9a323f8836','energy-sample-3','outline','ad9a323f8836'),
('energy-sample-3:bold:ad9a323f8836','energy-sample-3','bold','ad9a323f8836'),
('energy-sample-3:broken:ad9a323f8836','energy-sample-3','broken','ad9a323f8836'),
('energy-sample-3:bulk:ad9a323f8836','energy-sample-3','bulk','ad9a323f8836'),
('energy-sample-3:twotone:ad9a323f8836','energy-sample-3','twotone','ad9a323f8836'),
('kitchen-sample-1:linear:e2ce98340674','kitchen-sample-1','linear','e2ce98340674'),
('kitchen-sample-1:outline:e2ce98340674','kitchen-sample-1','outline','e2ce98340674'),
('kitchen-sample-1:bold:e2ce98340674','kitchen-sample-1','bold','e2ce98340674'),
('kitchen-sample-1:broken:e2ce98340674','kitchen-sample-1','broken','e2ce98340674'),
('kitchen-sample-1:bulk:e2ce98340674','kitchen-sample-1','bulk','e2ce98340674'),
('kitchen-sample-1:twotone:e2ce98340674','kitchen-sample-1','twotone','e2ce98340674'),
('kitchen-sample-2:linear:9991921ca0aa','kitchen-sample-2','linear','9991921ca0aa'),
('kitchen-sample-2:outline:9991921ca0aa','kitchen-sample-2','outline','9991921ca0aa'),
('kitchen-sample-2:bold:9991921ca0aa','kitchen-sample-2','bold','9991921ca0aa'),
('kitchen-sample-2:broken:9991921ca0aa','kitchen-sample-2','broken','9991921ca0aa'),
('kitchen-sample-2:bulk:9991921ca0aa','kitchen-sample-2','bulk','9991921ca0aa'),
('kitchen-sample-2:twotone:9991921ca0aa','kitchen-sample-2','twotone','9991921ca0aa'),
('kitchen-sample-3:linear:32f0d9a87295','kitchen-sample-3','linear','32f0d9a87295'),
('kitchen-sample-3:outline:32f0d9a87295','kitchen-sample-3','outline','32f0d9a87295'),
('kitchen-sample-3:bold:32f0d9a87295','kitchen-sample-3','bold','32f0d9a87295'),
('kitchen-sample-3:broken:32f0d9a87295','kitchen-sample-3','broken','32f0d9a87295'),
('kitchen-sample-3:bulk:32f0d9a87295','kitchen-sample-3','bulk','32f0d9a87295'),
('kitchen-sample-3:twotone:32f0d9a87295','kitchen-sample-3','twotone','32f0d9a87295')
on conflict(id) do nothing;
commit;

commit;

-- ============================================================================
-- 0030_library_asset_catalog.sql
-- ============================================================================

begin;

-- Synchronize all current library assets without deleting existing favorites.
begin;
insert into public.library_assets(id,design_id,style,version) values
('essential-sample-1:linear:b997df861a78','essential-sample-1','linear','b997df861a78'),
('essential-sample-1:outline:b997df861a78','essential-sample-1','outline','b997df861a78'),
('essential-sample-1:bold:b997df861a78','essential-sample-1','bold','b997df861a78'),
('essential-sample-1:broken:b997df861a78','essential-sample-1','broken','b997df861a78'),
('essential-sample-1:bulk:b997df861a78','essential-sample-1','bulk','b997df861a78'),
('essential-sample-1:twotone:b997df861a78','essential-sample-1','twotone','b997df861a78'),
('essential-sample-2:linear:73069cd713b9','essential-sample-2','linear','73069cd713b9'),
('essential-sample-2:outline:73069cd713b9','essential-sample-2','outline','73069cd713b9'),
('essential-sample-2:bold:73069cd713b9','essential-sample-2','bold','73069cd713b9'),
('essential-sample-2:broken:73069cd713b9','essential-sample-2','broken','73069cd713b9'),
('essential-sample-2:bulk:73069cd713b9','essential-sample-2','bulk','73069cd713b9'),
('essential-sample-2:twotone:73069cd713b9','essential-sample-2','twotone','73069cd713b9'),
('essential-sample-3:linear:0a37f8e798be','essential-sample-3','linear','0a37f8e798be'),
('essential-sample-3:outline:0a37f8e798be','essential-sample-3','outline','0a37f8e798be'),
('essential-sample-3:bold:0a37f8e798be','essential-sample-3','bold','0a37f8e798be'),
('essential-sample-3:broken:0a37f8e798be','essential-sample-3','broken','0a37f8e798be'),
('essential-sample-3:bulk:0a37f8e798be','essential-sample-3','bulk','0a37f8e798be'),
('essential-sample-3:twotone:0a37f8e798be','essential-sample-3','twotone','0a37f8e798be'),
('files-sample-1:linear:d3a25c690d88','files-sample-1','linear','d3a25c690d88'),
('files-sample-1:outline:d3a25c690d88','files-sample-1','outline','d3a25c690d88'),
('files-sample-1:bold:d3a25c690d88','files-sample-1','bold','d3a25c690d88'),
('files-sample-1:broken:d3a25c690d88','files-sample-1','broken','d3a25c690d88'),
('files-sample-1:bulk:d3a25c690d88','files-sample-1','bulk','d3a25c690d88'),
('files-sample-1:twotone:d3a25c690d88','files-sample-1','twotone','d3a25c690d88'),
('files-sample-2:linear:dd9f9357074a','files-sample-2','linear','dd9f9357074a'),
('files-sample-2:outline:dd9f9357074a','files-sample-2','outline','dd9f9357074a'),
('files-sample-2:bold:dd9f9357074a','files-sample-2','bold','dd9f9357074a'),
('files-sample-2:broken:dd9f9357074a','files-sample-2','broken','dd9f9357074a'),
('files-sample-2:bulk:dd9f9357074a','files-sample-2','bulk','dd9f9357074a'),
('files-sample-2:twotone:dd9f9357074a','files-sample-2','twotone','dd9f9357074a'),
('files-sample-3:linear:38921090775e','files-sample-3','linear','38921090775e'),
('files-sample-3:outline:38921090775e','files-sample-3','outline','38921090775e'),
('files-sample-3:bold:38921090775e','files-sample-3','bold','38921090775e'),
('files-sample-3:broken:38921090775e','files-sample-3','broken','38921090775e'),
('files-sample-3:bulk:38921090775e','files-sample-3','bulk','38921090775e'),
('files-sample-3:twotone:38921090775e','files-sample-3','twotone','38921090775e'),
('emoji-sample-1:linear:7f7faf600989','emoji-sample-1','linear','7f7faf600989'),
('emoji-sample-1:outline:7f7faf600989','emoji-sample-1','outline','7f7faf600989'),
('emoji-sample-1:bold:7f7faf600989','emoji-sample-1','bold','7f7faf600989'),
('emoji-sample-1:broken:7f7faf600989','emoji-sample-1','broken','7f7faf600989'),
('emoji-sample-1:bulk:7f7faf600989','emoji-sample-1','bulk','7f7faf600989'),
('emoji-sample-1:twotone:7f7faf600989','emoji-sample-1','twotone','7f7faf600989'),
('emoji-sample-2:linear:319ec268ced4','emoji-sample-2','linear','319ec268ced4'),
('emoji-sample-2:outline:319ec268ced4','emoji-sample-2','outline','319ec268ced4'),
('emoji-sample-2:bold:319ec268ced4','emoji-sample-2','bold','319ec268ced4'),
('emoji-sample-2:broken:319ec268ced4','emoji-sample-2','broken','319ec268ced4'),
('emoji-sample-2:bulk:319ec268ced4','emoji-sample-2','bulk','319ec268ced4'),
('emoji-sample-2:twotone:319ec268ced4','emoji-sample-2','twotone','319ec268ced4'),
('emoji-sample-3:linear:aa6e35f389aa','emoji-sample-3','linear','aa6e35f389aa'),
('emoji-sample-3:outline:aa6e35f389aa','emoji-sample-3','outline','aa6e35f389aa'),
('emoji-sample-3:bold:aa6e35f389aa','emoji-sample-3','bold','aa6e35f389aa'),
('emoji-sample-3:broken:aa6e35f389aa','emoji-sample-3','broken','aa6e35f389aa'),
('emoji-sample-3:bulk:aa6e35f389aa','emoji-sample-3','bulk','aa6e35f389aa'),
('emoji-sample-3:twotone:aa6e35f389aa','emoji-sample-3','twotone','aa6e35f389aa'),
('time-sample-1:linear:d23205648ee3','time-sample-1','linear','d23205648ee3'),
('time-sample-1:outline:d23205648ee3','time-sample-1','outline','d23205648ee3'),
('time-sample-1:bold:d23205648ee3','time-sample-1','bold','d23205648ee3'),
('time-sample-1:broken:d23205648ee3','time-sample-1','broken','d23205648ee3'),
('time-sample-1:bulk:d23205648ee3','time-sample-1','bulk','d23205648ee3'),
('time-sample-1:twotone:d23205648ee3','time-sample-1','twotone','d23205648ee3'),
('time-sample-2:linear:187c586f10bb','time-sample-2','linear','187c586f10bb'),
('time-sample-2:outline:187c586f10bb','time-sample-2','outline','187c586f10bb'),
('time-sample-2:bold:187c586f10bb','time-sample-2','bold','187c586f10bb'),
('time-sample-2:broken:187c586f10bb','time-sample-2','broken','187c586f10bb'),
('time-sample-2:bulk:187c586f10bb','time-sample-2','bulk','187c586f10bb'),
('time-sample-2:twotone:187c586f10bb','time-sample-2','twotone','187c586f10bb'),
('time-sample-3:linear:931fcc00e478','time-sample-3','linear','931fcc00e478'),
('time-sample-3:outline:931fcc00e478','time-sample-3','outline','931fcc00e478'),
('time-sample-3:bold:931fcc00e478','time-sample-3','bold','931fcc00e478'),
('time-sample-3:broken:931fcc00e478','time-sample-3','broken','931fcc00e478'),
('time-sample-3:bulk:931fcc00e478','time-sample-3','bulk','931fcc00e478'),
('time-sample-3:twotone:931fcc00e478','time-sample-3','twotone','931fcc00e478'),
('weather-sample-1:linear:d6aff14bbdf3','weather-sample-1','linear','d6aff14bbdf3'),
('weather-sample-1:outline:d6aff14bbdf3','weather-sample-1','outline','d6aff14bbdf3'),
('weather-sample-1:bold:d6aff14bbdf3','weather-sample-1','bold','d6aff14bbdf3'),
('weather-sample-1:broken:d6aff14bbdf3','weather-sample-1','broken','d6aff14bbdf3'),
('weather-sample-1:bulk:d6aff14bbdf3','weather-sample-1','bulk','d6aff14bbdf3'),
('weather-sample-1:twotone:d6aff14bbdf3','weather-sample-1','twotone','d6aff14bbdf3'),
('weather-sample-2:linear:ebb6018cdd12','weather-sample-2','linear','ebb6018cdd12'),
('weather-sample-2:outline:ebb6018cdd12','weather-sample-2','outline','ebb6018cdd12'),
('weather-sample-2:bold:ebb6018cdd12','weather-sample-2','bold','ebb6018cdd12'),
('weather-sample-2:broken:ebb6018cdd12','weather-sample-2','broken','ebb6018cdd12'),
('weather-sample-2:bulk:ebb6018cdd12','weather-sample-2','bulk','ebb6018cdd12'),
('weather-sample-2:twotone:ebb6018cdd12','weather-sample-2','twotone','ebb6018cdd12'),
('weather-sample-3:linear:c47614321184','weather-sample-3','linear','c47614321184'),
('weather-sample-3:outline:c47614321184','weather-sample-3','outline','c47614321184'),
('weather-sample-3:bold:c47614321184','weather-sample-3','bold','c47614321184'),
('weather-sample-3:broken:c47614321184','weather-sample-3','broken','c47614321184'),
('weather-sample-3:bulk:c47614321184','weather-sample-3','bulk','c47614321184'),
('weather-sample-3:twotone:c47614321184','weather-sample-3','twotone','c47614321184'),
('food-sample-1:linear:094754141f5b','food-sample-1','linear','094754141f5b'),
('food-sample-1:outline:094754141f5b','food-sample-1','outline','094754141f5b'),
('food-sample-1:bold:094754141f5b','food-sample-1','bold','094754141f5b'),
('food-sample-1:broken:094754141f5b','food-sample-1','broken','094754141f5b'),
('food-sample-1:bulk:094754141f5b','food-sample-1','bulk','094754141f5b'),
('food-sample-1:twotone:094754141f5b','food-sample-1','twotone','094754141f5b'),
('food-sample-2:linear:7a18e81dcef5','food-sample-2','linear','7a18e81dcef5'),
('food-sample-2:outline:7a18e81dcef5','food-sample-2','outline','7a18e81dcef5'),
('food-sample-2:bold:7a18e81dcef5','food-sample-2','bold','7a18e81dcef5'),
('food-sample-2:broken:7a18e81dcef5','food-sample-2','broken','7a18e81dcef5'),
('food-sample-2:bulk:7a18e81dcef5','food-sample-2','bulk','7a18e81dcef5'),
('food-sample-2:twotone:7a18e81dcef5','food-sample-2','twotone','7a18e81dcef5'),
('food-sample-3:linear:fd79f6242b4c','food-sample-3','linear','fd79f6242b4c'),
('food-sample-3:outline:fd79f6242b4c','food-sample-3','outline','fd79f6242b4c'),
('food-sample-3:bold:fd79f6242b4c','food-sample-3','bold','fd79f6242b4c'),
('food-sample-3:broken:fd79f6242b4c','food-sample-3','broken','fd79f6242b4c'),
('food-sample-3:bulk:fd79f6242b4c','food-sample-3','bulk','fd79f6242b4c'),
('food-sample-3:twotone:fd79f6242b4c','food-sample-3','twotone','fd79f6242b4c'),
('energy-sample-1:linear:1a5f637adac5','energy-sample-1','linear','1a5f637adac5'),
('energy-sample-1:outline:1a5f637adac5','energy-sample-1','outline','1a5f637adac5'),
('energy-sample-1:bold:1a5f637adac5','energy-sample-1','bold','1a5f637adac5'),
('energy-sample-1:broken:1a5f637adac5','energy-sample-1','broken','1a5f637adac5'),
('energy-sample-1:bulk:1a5f637adac5','energy-sample-1','bulk','1a5f637adac5'),
('energy-sample-1:twotone:1a5f637adac5','energy-sample-1','twotone','1a5f637adac5'),
('energy-sample-2:linear:b5b39c74d110','energy-sample-2','linear','b5b39c74d110'),
('energy-sample-2:outline:b5b39c74d110','energy-sample-2','outline','b5b39c74d110'),
('energy-sample-2:bold:b5b39c74d110','energy-sample-2','bold','b5b39c74d110'),
('energy-sample-2:broken:b5b39c74d110','energy-sample-2','broken','b5b39c74d110'),
('energy-sample-2:bulk:b5b39c74d110','energy-sample-2','bulk','b5b39c74d110'),
('energy-sample-2:twotone:b5b39c74d110','energy-sample-2','twotone','b5b39c74d110'),
('energy-sample-3:linear:ad9a323f8836','energy-sample-3','linear','ad9a323f8836'),
('energy-sample-3:outline:ad9a323f8836','energy-sample-3','outline','ad9a323f8836'),
('energy-sample-3:bold:ad9a323f8836','energy-sample-3','bold','ad9a323f8836'),
('energy-sample-3:broken:ad9a323f8836','energy-sample-3','broken','ad9a323f8836'),
('energy-sample-3:bulk:ad9a323f8836','energy-sample-3','bulk','ad9a323f8836'),
('energy-sample-3:twotone:ad9a323f8836','energy-sample-3','twotone','ad9a323f8836'),
('kitchen-sample-1:linear:e2ce98340674','kitchen-sample-1','linear','e2ce98340674'),
('kitchen-sample-1:outline:e2ce98340674','kitchen-sample-1','outline','e2ce98340674'),
('kitchen-sample-1:bold:e2ce98340674','kitchen-sample-1','bold','e2ce98340674'),
('kitchen-sample-1:broken:e2ce98340674','kitchen-sample-1','broken','e2ce98340674'),
('kitchen-sample-1:bulk:e2ce98340674','kitchen-sample-1','bulk','e2ce98340674'),
('kitchen-sample-1:twotone:e2ce98340674','kitchen-sample-1','twotone','e2ce98340674'),
('kitchen-sample-2:linear:9991921ca0aa','kitchen-sample-2','linear','9991921ca0aa'),
('kitchen-sample-2:outline:9991921ca0aa','kitchen-sample-2','outline','9991921ca0aa'),
('kitchen-sample-2:bold:9991921ca0aa','kitchen-sample-2','bold','9991921ca0aa'),
('kitchen-sample-2:broken:9991921ca0aa','kitchen-sample-2','broken','9991921ca0aa'),
('kitchen-sample-2:bulk:9991921ca0aa','kitchen-sample-2','bulk','9991921ca0aa'),
('kitchen-sample-2:twotone:9991921ca0aa','kitchen-sample-2','twotone','9991921ca0aa'),
('kitchen-sample-3:linear:32f0d9a87295','kitchen-sample-3','linear','32f0d9a87295'),
('kitchen-sample-3:outline:32f0d9a87295','kitchen-sample-3','outline','32f0d9a87295'),
('kitchen-sample-3:bold:32f0d9a87295','kitchen-sample-3','bold','32f0d9a87295'),
('kitchen-sample-3:broken:32f0d9a87295','kitchen-sample-3','broken','32f0d9a87295'),
('kitchen-sample-3:bulk:32f0d9a87295','kitchen-sample-3','bulk','32f0d9a87295'),
('kitchen-sample-3:twotone:32f0d9a87295','kitchen-sample-3','twotone','32f0d9a87295'),
('archive-sample-1:linear:31ca397857eb','archive-sample-1','linear','31ca397857eb'),
('archive-sample-1:outline:31ca397857eb','archive-sample-1','outline','31ca397857eb'),
('archive-sample-1:bold:31ca397857eb','archive-sample-1','bold','31ca397857eb'),
('archive-sample-1:broken:31ca397857eb','archive-sample-1','broken','31ca397857eb'),
('archive-sample-1:bulk:31ca397857eb','archive-sample-1','bulk','31ca397857eb'),
('archive-sample-1:twotone:31ca397857eb','archive-sample-1','twotone','31ca397857eb'),
('archive-sample-2:linear:a0d4edfe33f6','archive-sample-2','linear','a0d4edfe33f6'),
('archive-sample-2:outline:a0d4edfe33f6','archive-sample-2','outline','a0d4edfe33f6'),
('archive-sample-2:bold:a0d4edfe33f6','archive-sample-2','bold','a0d4edfe33f6'),
('archive-sample-2:broken:a0d4edfe33f6','archive-sample-2','broken','a0d4edfe33f6'),
('archive-sample-2:bulk:a0d4edfe33f6','archive-sample-2','bulk','a0d4edfe33f6'),
('archive-sample-2:twotone:a0d4edfe33f6','archive-sample-2','twotone','a0d4edfe33f6'),
('archive-sample-3:linear:146a1f661879','archive-sample-3','linear','146a1f661879'),
('archive-sample-3:outline:146a1f661879','archive-sample-3','outline','146a1f661879'),
('archive-sample-3:bold:146a1f661879','archive-sample-3','bold','146a1f661879'),
('archive-sample-3:broken:146a1f661879','archive-sample-3','broken','146a1f661879'),
('archive-sample-3:bulk:146a1f661879','archive-sample-3','bulk','146a1f661879'),
('archive-sample-3:twotone:146a1f661879','archive-sample-3','twotone','146a1f661879'),
('beauty-sample-1:linear:ddb0933cef43','beauty-sample-1','linear','ddb0933cef43'),
('beauty-sample-1:outline:ddb0933cef43','beauty-sample-1','outline','ddb0933cef43'),
('beauty-sample-1:bold:ddb0933cef43','beauty-sample-1','bold','ddb0933cef43'),
('beauty-sample-1:broken:ddb0933cef43','beauty-sample-1','broken','ddb0933cef43'),
('beauty-sample-1:bulk:ddb0933cef43','beauty-sample-1','bulk','ddb0933cef43'),
('beauty-sample-1:twotone:ddb0933cef43','beauty-sample-1','twotone','ddb0933cef43'),
('beauty-sample-2:linear:e72363eaeed6','beauty-sample-2','linear','e72363eaeed6'),
('beauty-sample-2:outline:e72363eaeed6','beauty-sample-2','outline','e72363eaeed6'),
('beauty-sample-2:bold:e72363eaeed6','beauty-sample-2','bold','e72363eaeed6'),
('beauty-sample-2:broken:e72363eaeed6','beauty-sample-2','broken','e72363eaeed6'),
('beauty-sample-2:bulk:e72363eaeed6','beauty-sample-2','bulk','e72363eaeed6'),
('beauty-sample-2:twotone:e72363eaeed6','beauty-sample-2','twotone','e72363eaeed6'),
('beauty-sample-3:linear:1ebc900b67af','beauty-sample-3','linear','1ebc900b67af'),
('beauty-sample-3:outline:1ebc900b67af','beauty-sample-3','outline','1ebc900b67af'),
('beauty-sample-3:bold:1ebc900b67af','beauty-sample-3','bold','1ebc900b67af'),
('beauty-sample-3:broken:1ebc900b67af','beauty-sample-3','broken','1ebc900b67af'),
('beauty-sample-3:bulk:1ebc900b67af','beauty-sample-3','bulk','1ebc900b67af'),
('beauty-sample-3:twotone:1ebc900b67af','beauty-sample-3','twotone','1ebc900b67af'),
('booking-sample-1:linear:1313490aa2ca','booking-sample-1','linear','1313490aa2ca'),
('booking-sample-1:outline:1313490aa2ca','booking-sample-1','outline','1313490aa2ca'),
('booking-sample-1:bold:1313490aa2ca','booking-sample-1','bold','1313490aa2ca'),
('booking-sample-1:broken:1313490aa2ca','booking-sample-1','broken','1313490aa2ca'),
('booking-sample-1:bulk:1313490aa2ca','booking-sample-1','bulk','1313490aa2ca'),
('booking-sample-1:twotone:1313490aa2ca','booking-sample-1','twotone','1313490aa2ca'),
('booking-sample-2:linear:0b272fe748a4','booking-sample-2','linear','0b272fe748a4'),
('booking-sample-2:outline:0b272fe748a4','booking-sample-2','outline','0b272fe748a4'),
('booking-sample-2:bold:0b272fe748a4','booking-sample-2','bold','0b272fe748a4'),
('booking-sample-2:broken:0b272fe748a4','booking-sample-2','broken','0b272fe748a4'),
('booking-sample-2:bulk:0b272fe748a4','booking-sample-2','bulk','0b272fe748a4'),
('booking-sample-2:twotone:0b272fe748a4','booking-sample-2','twotone','0b272fe748a4'),
('booking-sample-3:linear:11842043d6f4','booking-sample-3','linear','11842043d6f4'),
('booking-sample-3:outline:11842043d6f4','booking-sample-3','outline','11842043d6f4'),
('booking-sample-3:bold:11842043d6f4','booking-sample-3','bold','11842043d6f4'),
('booking-sample-3:broken:11842043d6f4','booking-sample-3','broken','11842043d6f4'),
('booking-sample-3:bulk:11842043d6f4','booking-sample-3','bulk','11842043d6f4'),
('booking-sample-3:twotone:11842043d6f4','booking-sample-3','twotone','11842043d6f4'),
('computers-devices-electronics-sample-1:linear:9d988ae22daa','computers-devices-electronics-sample-1','linear','9d988ae22daa'),
('computers-devices-electronics-sample-1:outline:9d988ae22daa','computers-devices-electronics-sample-1','outline','9d988ae22daa'),
('computers-devices-electronics-sample-1:bold:9d988ae22daa','computers-devices-electronics-sample-1','bold','9d988ae22daa'),
('computers-devices-electronics-sample-1:broken:9d988ae22daa','computers-devices-electronics-sample-1','broken','9d988ae22daa'),
('computers-devices-electronics-sample-1:bulk:9d988ae22daa','computers-devices-electronics-sample-1','bulk','9d988ae22daa'),
('computers-devices-electronics-sample-1:twotone:9d988ae22daa','computers-devices-electronics-sample-1','twotone','9d988ae22daa'),
('computers-devices-electronics-sample-2:linear:b2e3fe1f3bb2','computers-devices-electronics-sample-2','linear','b2e3fe1f3bb2'),
('computers-devices-electronics-sample-2:outline:b2e3fe1f3bb2','computers-devices-electronics-sample-2','outline','b2e3fe1f3bb2'),
('computers-devices-electronics-sample-2:bold:b2e3fe1f3bb2','computers-devices-electronics-sample-2','bold','b2e3fe1f3bb2'),
('computers-devices-electronics-sample-2:broken:b2e3fe1f3bb2','computers-devices-electronics-sample-2','broken','b2e3fe1f3bb2'),
('computers-devices-electronics-sample-2:bulk:b2e3fe1f3bb2','computers-devices-electronics-sample-2','bulk','b2e3fe1f3bb2'),
('computers-devices-electronics-sample-2:twotone:b2e3fe1f3bb2','computers-devices-electronics-sample-2','twotone','b2e3fe1f3bb2'),
('computers-devices-electronics-sample-3:linear:d62fbc51eddf','computers-devices-electronics-sample-3','linear','d62fbc51eddf'),
('computers-devices-electronics-sample-3:outline:d62fbc51eddf','computers-devices-electronics-sample-3','outline','d62fbc51eddf'),
('computers-devices-electronics-sample-3:bold:d62fbc51eddf','computers-devices-electronics-sample-3','bold','d62fbc51eddf'),
('computers-devices-electronics-sample-3:broken:d62fbc51eddf','computers-devices-electronics-sample-3','broken','d62fbc51eddf'),
('computers-devices-electronics-sample-3:bulk:d62fbc51eddf','computers-devices-electronics-sample-3','bulk','d62fbc51eddf'),
('computers-devices-electronics-sample-3:twotone:d62fbc51eddf','computers-devices-electronics-sample-3','twotone','d62fbc51eddf'),
('email-sample-1:linear:a7a0a6319864','email-sample-1','linear','a7a0a6319864'),
('email-sample-1:outline:a7a0a6319864','email-sample-1','outline','a7a0a6319864'),
('email-sample-1:bold:a7a0a6319864','email-sample-1','bold','a7a0a6319864'),
('email-sample-1:broken:a7a0a6319864','email-sample-1','broken','a7a0a6319864'),
('email-sample-1:bulk:a7a0a6319864','email-sample-1','bulk','a7a0a6319864'),
('email-sample-1:twotone:a7a0a6319864','email-sample-1','twotone','a7a0a6319864'),
('email-sample-2:linear:b4a2a5bcf439','email-sample-2','linear','b4a2a5bcf439'),
('email-sample-2:outline:b4a2a5bcf439','email-sample-2','outline','b4a2a5bcf439'),
('email-sample-2:bold:b4a2a5bcf439','email-sample-2','bold','b4a2a5bcf439'),
('email-sample-2:broken:b4a2a5bcf439','email-sample-2','broken','b4a2a5bcf439'),
('email-sample-2:bulk:b4a2a5bcf439','email-sample-2','bulk','b4a2a5bcf439'),
('email-sample-2:twotone:b4a2a5bcf439','email-sample-2','twotone','b4a2a5bcf439'),
('email-sample-3:linear:476e27558ac0','email-sample-3','linear','476e27558ac0'),
('email-sample-3:outline:476e27558ac0','email-sample-3','outline','476e27558ac0'),
('email-sample-3:bold:476e27558ac0','email-sample-3','bold','476e27558ac0'),
('email-sample-3:broken:476e27558ac0','email-sample-3','broken','476e27558ac0'),
('email-sample-3:bulk:476e27558ac0','email-sample-3','bulk','476e27558ac0'),
('email-sample-3:twotone:476e27558ac0','email-sample-3','twotone','476e27558ac0'),
('medical-sample-1:linear:c5a029f30cd4','medical-sample-1','linear','c5a029f30cd4'),
('medical-sample-1:outline:c5a029f30cd4','medical-sample-1','outline','c5a029f30cd4'),
('medical-sample-1:bold:c5a029f30cd4','medical-sample-1','bold','c5a029f30cd4'),
('medical-sample-1:broken:c5a029f30cd4','medical-sample-1','broken','c5a029f30cd4'),
('medical-sample-1:bulk:c5a029f30cd4','medical-sample-1','bulk','c5a029f30cd4'),
('medical-sample-1:twotone:c5a029f30cd4','medical-sample-1','twotone','c5a029f30cd4'),
('medical-sample-2:linear:59d54c8d55ce','medical-sample-2','linear','59d54c8d55ce'),
('medical-sample-2:outline:59d54c8d55ce','medical-sample-2','outline','59d54c8d55ce'),
('medical-sample-2:bold:59d54c8d55ce','medical-sample-2','bold','59d54c8d55ce'),
('medical-sample-2:broken:59d54c8d55ce','medical-sample-2','broken','59d54c8d55ce'),
('medical-sample-2:bulk:59d54c8d55ce','medical-sample-2','bulk','59d54c8d55ce'),
('medical-sample-2:twotone:59d54c8d55ce','medical-sample-2','twotone','59d54c8d55ce'),
('medical-sample-3:linear:dae0765fa75b','medical-sample-3','linear','dae0765fa75b'),
('medical-sample-3:outline:dae0765fa75b','medical-sample-3','outline','dae0765fa75b'),
('medical-sample-3:bold:dae0765fa75b','medical-sample-3','bold','dae0765fa75b'),
('medical-sample-3:broken:dae0765fa75b','medical-sample-3','broken','dae0765fa75b'),
('medical-sample-3:bulk:dae0765fa75b','medical-sample-3','bulk','dae0765fa75b'),
('medical-sample-3:twotone:dae0765fa75b','medical-sample-3','twotone','dae0765fa75b'),
('security-sample-1:linear:15c9a9945077','security-sample-1','linear','15c9a9945077'),
('security-sample-1:outline:15c9a9945077','security-sample-1','outline','15c9a9945077'),
('security-sample-1:bold:15c9a9945077','security-sample-1','bold','15c9a9945077'),
('security-sample-1:broken:15c9a9945077','security-sample-1','broken','15c9a9945077'),
('security-sample-1:bulk:15c9a9945077','security-sample-1','bulk','15c9a9945077'),
('security-sample-1:twotone:15c9a9945077','security-sample-1','twotone','15c9a9945077'),
('security-sample-2:linear:b1ca09b9fd7e','security-sample-2','linear','b1ca09b9fd7e'),
('security-sample-2:outline:b1ca09b9fd7e','security-sample-2','outline','b1ca09b9fd7e'),
('security-sample-2:bold:b1ca09b9fd7e','security-sample-2','bold','b1ca09b9fd7e'),
('security-sample-2:broken:b1ca09b9fd7e','security-sample-2','broken','b1ca09b9fd7e'),
('security-sample-2:bulk:b1ca09b9fd7e','security-sample-2','bulk','b1ca09b9fd7e'),
('security-sample-2:twotone:b1ca09b9fd7e','security-sample-2','twotone','b1ca09b9fd7e'),
('security-sample-3:linear:8218d5ad7e72','security-sample-3','linear','8218d5ad7e72'),
('security-sample-3:outline:8218d5ad7e72','security-sample-3','outline','8218d5ad7e72'),
('security-sample-3:bold:8218d5ad7e72','security-sample-3','bold','8218d5ad7e72'),
('security-sample-3:broken:8218d5ad7e72','security-sample-3','broken','8218d5ad7e72'),
('security-sample-3:bulk:8218d5ad7e72','security-sample-3','bulk','8218d5ad7e72'),
('security-sample-3:twotone:8218d5ad7e72','security-sample-3','twotone','8218d5ad7e72'),
('location-sample-1:linear:4581d5e54289','location-sample-1','linear','4581d5e54289'),
('location-sample-1:outline:4581d5e54289','location-sample-1','outline','4581d5e54289'),
('location-sample-1:bold:4581d5e54289','location-sample-1','bold','4581d5e54289'),
('location-sample-1:broken:4581d5e54289','location-sample-1','broken','4581d5e54289'),
('location-sample-1:bulk:4581d5e54289','location-sample-1','bulk','4581d5e54289'),
('location-sample-1:twotone:4581d5e54289','location-sample-1','twotone','4581d5e54289'),
('location-sample-2:linear:61809684eccb','location-sample-2','linear','61809684eccb'),
('location-sample-2:outline:61809684eccb','location-sample-2','outline','61809684eccb'),
('location-sample-2:bold:61809684eccb','location-sample-2','bold','61809684eccb'),
('location-sample-2:broken:61809684eccb','location-sample-2','broken','61809684eccb'),
('location-sample-2:bulk:61809684eccb','location-sample-2','bulk','61809684eccb'),
('location-sample-2:twotone:61809684eccb','location-sample-2','twotone','61809684eccb'),
('location-sample-3:linear:6c201b6390b3','location-sample-3','linear','6c201b6390b3'),
('location-sample-3:outline:6c201b6390b3','location-sample-3','outline','6c201b6390b3'),
('location-sample-3:bold:6c201b6390b3','location-sample-3','bold','6c201b6390b3'),
('location-sample-3:broken:6c201b6390b3','location-sample-3','broken','6c201b6390b3'),
('location-sample-3:bulk:6c201b6390b3','location-sample-3','bulk','6c201b6390b3'),
('location-sample-3:twotone:6c201b6390b3','location-sample-3','twotone','6c201b6390b3'),
('home-sample-1:linear:6102760a2ffe','home-sample-1','linear','6102760a2ffe'),
('home-sample-1:outline:6102760a2ffe','home-sample-1','outline','6102760a2ffe'),
('home-sample-1:bold:6102760a2ffe','home-sample-1','bold','6102760a2ffe'),
('home-sample-1:broken:6102760a2ffe','home-sample-1','broken','6102760a2ffe'),
('home-sample-1:bulk:6102760a2ffe','home-sample-1','bulk','6102760a2ffe'),
('home-sample-1:twotone:6102760a2ffe','home-sample-1','twotone','6102760a2ffe'),
('home-sample-2:linear:1e51a859e95e','home-sample-2','linear','1e51a859e95e'),
('home-sample-2:outline:1e51a859e95e','home-sample-2','outline','1e51a859e95e'),
('home-sample-2:bold:1e51a859e95e','home-sample-2','bold','1e51a859e95e'),
('home-sample-2:broken:1e51a859e95e','home-sample-2','broken','1e51a859e95e'),
('home-sample-2:bulk:1e51a859e95e','home-sample-2','bulk','1e51a859e95e'),
('home-sample-2:twotone:1e51a859e95e','home-sample-2','twotone','1e51a859e95e'),
('home-sample-3:linear:bfc5d2d81662','home-sample-3','linear','bfc5d2d81662'),
('home-sample-3:outline:bfc5d2d81662','home-sample-3','outline','bfc5d2d81662'),
('home-sample-3:bold:bfc5d2d81662','home-sample-3','bold','bfc5d2d81662'),
('home-sample-3:broken:bfc5d2d81662','home-sample-3','broken','bfc5d2d81662'),
('home-sample-3:bulk:bfc5d2d81662','home-sample-3','bulk','bfc5d2d81662'),
('home-sample-3:twotone:bfc5d2d81662','home-sample-3','twotone','bfc5d2d81662'),
('clothes-sample-1:linear:14f9ff8c4f95','clothes-sample-1','linear','14f9ff8c4f95'),
('clothes-sample-1:outline:14f9ff8c4f95','clothes-sample-1','outline','14f9ff8c4f95'),
('clothes-sample-1:bold:14f9ff8c4f95','clothes-sample-1','bold','14f9ff8c4f95'),
('clothes-sample-1:broken:14f9ff8c4f95','clothes-sample-1','broken','14f9ff8c4f95'),
('clothes-sample-1:bulk:14f9ff8c4f95','clothes-sample-1','bulk','14f9ff8c4f95'),
('clothes-sample-1:twotone:14f9ff8c4f95','clothes-sample-1','twotone','14f9ff8c4f95'),
('clothes-sample-2:linear:b997073e09ff','clothes-sample-2','linear','b997073e09ff'),
('clothes-sample-2:outline:b997073e09ff','clothes-sample-2','outline','b997073e09ff'),
('clothes-sample-2:bold:b997073e09ff','clothes-sample-2','bold','b997073e09ff'),
('clothes-sample-2:broken:b997073e09ff','clothes-sample-2','broken','b997073e09ff'),
('clothes-sample-2:bulk:b997073e09ff','clothes-sample-2','bulk','b997073e09ff'),
('clothes-sample-2:twotone:b997073e09ff','clothes-sample-2','twotone','b997073e09ff'),
('clothes-sample-3:linear:9ebfeb3aa810','clothes-sample-3','linear','9ebfeb3aa810'),
('clothes-sample-3:outline:9ebfeb3aa810','clothes-sample-3','outline','9ebfeb3aa810'),
('clothes-sample-3:bold:9ebfeb3aa810','clothes-sample-3','bold','9ebfeb3aa810'),
('clothes-sample-3:broken:9ebfeb3aa810','clothes-sample-3','broken','9ebfeb3aa810'),
('clothes-sample-3:bulk:9ebfeb3aa810','clothes-sample-3','bulk','9ebfeb3aa810'),
('clothes-sample-3:twotone:9ebfeb3aa810','clothes-sample-3','twotone','9ebfeb3aa810'),
('stationery-sample-1:linear:517afa12a56b','stationery-sample-1','linear','517afa12a56b'),
('stationery-sample-1:outline:517afa12a56b','stationery-sample-1','outline','517afa12a56b'),
('stationery-sample-1:bold:517afa12a56b','stationery-sample-1','bold','517afa12a56b'),
('stationery-sample-1:broken:517afa12a56b','stationery-sample-1','broken','517afa12a56b'),
('stationery-sample-1:bulk:517afa12a56b','stationery-sample-1','bulk','517afa12a56b'),
('stationery-sample-1:twotone:517afa12a56b','stationery-sample-1','twotone','517afa12a56b'),
('stationery-sample-2:linear:42a187d4348c','stationery-sample-2','linear','42a187d4348c'),
('stationery-sample-2:outline:42a187d4348c','stationery-sample-2','outline','42a187d4348c'),
('stationery-sample-2:bold:42a187d4348c','stationery-sample-2','bold','42a187d4348c'),
('stationery-sample-2:broken:42a187d4348c','stationery-sample-2','broken','42a187d4348c'),
('stationery-sample-2:bulk:42a187d4348c','stationery-sample-2','bulk','42a187d4348c'),
('stationery-sample-2:twotone:42a187d4348c','stationery-sample-2','twotone','42a187d4348c'),
('stationery-sample-3:linear:727ab453f7d2','stationery-sample-3','linear','727ab453f7d2'),
('stationery-sample-3:outline:727ab453f7d2','stationery-sample-3','outline','727ab453f7d2'),
('stationery-sample-3:bold:727ab453f7d2','stationery-sample-3','bold','727ab453f7d2'),
('stationery-sample-3:broken:727ab453f7d2','stationery-sample-3','broken','727ab453f7d2'),
('stationery-sample-3:bulk:727ab453f7d2','stationery-sample-3','bulk','727ab453f7d2'),
('stationery-sample-3:twotone:727ab453f7d2','stationery-sample-3','twotone','727ab453f7d2'),
('design-sample-1:linear:d622ce37ad1f','design-sample-1','linear','d622ce37ad1f'),
('design-sample-1:outline:d622ce37ad1f','design-sample-1','outline','d622ce37ad1f'),
('design-sample-1:bold:d622ce37ad1f','design-sample-1','bold','d622ce37ad1f'),
('design-sample-1:broken:d622ce37ad1f','design-sample-1','broken','d622ce37ad1f'),
('design-sample-1:bulk:d622ce37ad1f','design-sample-1','bulk','d622ce37ad1f'),
('design-sample-1:twotone:d622ce37ad1f','design-sample-1','twotone','d622ce37ad1f'),
('design-sample-2:linear:f9b36a8e5820','design-sample-2','linear','f9b36a8e5820'),
('design-sample-2:outline:f9b36a8e5820','design-sample-2','outline','f9b36a8e5820'),
('design-sample-2:bold:f9b36a8e5820','design-sample-2','bold','f9b36a8e5820'),
('design-sample-2:broken:f9b36a8e5820','design-sample-2','broken','f9b36a8e5820'),
('design-sample-2:bulk:f9b36a8e5820','design-sample-2','bulk','f9b36a8e5820'),
('design-sample-2:twotone:f9b36a8e5820','design-sample-2','twotone','f9b36a8e5820'),
('design-sample-3:linear:51fcb7b8a49f','design-sample-3','linear','51fcb7b8a49f'),
('design-sample-3:outline:51fcb7b8a49f','design-sample-3','outline','51fcb7b8a49f'),
('design-sample-3:bold:51fcb7b8a49f','design-sample-3','bold','51fcb7b8a49f'),
('design-sample-3:broken:51fcb7b8a49f','design-sample-3','broken','51fcb7b8a49f'),
('design-sample-3:bulk:51fcb7b8a49f','design-sample-3','bulk','51fcb7b8a49f'),
('design-sample-3:twotone:51fcb7b8a49f','design-sample-3','twotone','51fcb7b8a49f'),
('school-learning-sample-1:linear:79ee7f273f77','school-learning-sample-1','linear','79ee7f273f77'),
('school-learning-sample-1:outline:79ee7f273f77','school-learning-sample-1','outline','79ee7f273f77'),
('school-learning-sample-1:bold:79ee7f273f77','school-learning-sample-1','bold','79ee7f273f77'),
('school-learning-sample-1:broken:79ee7f273f77','school-learning-sample-1','broken','79ee7f273f77'),
('school-learning-sample-1:bulk:79ee7f273f77','school-learning-sample-1','bulk','79ee7f273f77'),
('school-learning-sample-1:twotone:79ee7f273f77','school-learning-sample-1','twotone','79ee7f273f77'),
('school-learning-sample-2:linear:3d929ae89c0a','school-learning-sample-2','linear','3d929ae89c0a'),
('school-learning-sample-2:outline:3d929ae89c0a','school-learning-sample-2','outline','3d929ae89c0a'),
('school-learning-sample-2:bold:3d929ae89c0a','school-learning-sample-2','bold','3d929ae89c0a'),
('school-learning-sample-2:broken:3d929ae89c0a','school-learning-sample-2','broken','3d929ae89c0a'),
('school-learning-sample-2:bulk:3d929ae89c0a','school-learning-sample-2','bulk','3d929ae89c0a'),
('school-learning-sample-2:twotone:3d929ae89c0a','school-learning-sample-2','twotone','3d929ae89c0a'),
('school-learning-sample-3:linear:9e7e5fa6590b','school-learning-sample-3','linear','9e7e5fa6590b'),
('school-learning-sample-3:outline:9e7e5fa6590b','school-learning-sample-3','outline','9e7e5fa6590b'),
('school-learning-sample-3:bold:9e7e5fa6590b','school-learning-sample-3','bold','9e7e5fa6590b'),
('school-learning-sample-3:broken:9e7e5fa6590b','school-learning-sample-3','broken','9e7e5fa6590b'),
('school-learning-sample-3:bulk:9e7e5fa6590b','school-learning-sample-3','bulk','9e7e5fa6590b'),
('school-learning-sample-3:twotone:9e7e5fa6590b','school-learning-sample-3','twotone','9e7e5fa6590b'),
('money-sample-1:linear:d0ea22802567','money-sample-1','linear','d0ea22802567'),
('money-sample-1:outline:d0ea22802567','money-sample-1','outline','d0ea22802567'),
('money-sample-1:bold:d0ea22802567','money-sample-1','bold','d0ea22802567'),
('money-sample-1:broken:d0ea22802567','money-sample-1','broken','d0ea22802567'),
('money-sample-1:bulk:d0ea22802567','money-sample-1','bulk','d0ea22802567'),
('money-sample-1:twotone:d0ea22802567','money-sample-1','twotone','d0ea22802567'),
('money-sample-2:linear:c07caef25f6e','money-sample-2','linear','c07caef25f6e'),
('money-sample-2:outline:c07caef25f6e','money-sample-2','outline','c07caef25f6e'),
('money-sample-2:bold:c07caef25f6e','money-sample-2','bold','c07caef25f6e'),
('money-sample-2:broken:c07caef25f6e','money-sample-2','broken','c07caef25f6e'),
('money-sample-2:bulk:c07caef25f6e','money-sample-2','bulk','c07caef25f6e'),
('money-sample-2:twotone:c07caef25f6e','money-sample-2','twotone','c07caef25f6e'),
('money-sample-3:linear:1f11ce9dbf66','money-sample-3','linear','1f11ce9dbf66'),
('money-sample-3:outline:1f11ce9dbf66','money-sample-3','outline','1f11ce9dbf66'),
('money-sample-3:bold:1f11ce9dbf66','money-sample-3','bold','1f11ce9dbf66'),
('money-sample-3:broken:1f11ce9dbf66','money-sample-3','broken','1f11ce9dbf66'),
('money-sample-3:bulk:1f11ce9dbf66','money-sample-3','bulk','1f11ce9dbf66'),
('money-sample-3:twotone:1f11ce9dbf66','money-sample-3','twotone','1f11ce9dbf66'),
('shop-sample-1:linear:0c7dee938ed5','shop-sample-1','linear','0c7dee938ed5'),
('shop-sample-1:outline:0c7dee938ed5','shop-sample-1','outline','0c7dee938ed5'),
('shop-sample-1:bold:0c7dee938ed5','shop-sample-1','bold','0c7dee938ed5'),
('shop-sample-1:broken:0c7dee938ed5','shop-sample-1','broken','0c7dee938ed5'),
('shop-sample-1:bulk:0c7dee938ed5','shop-sample-1','bulk','0c7dee938ed5'),
('shop-sample-1:twotone:0c7dee938ed5','shop-sample-1','twotone','0c7dee938ed5'),
('shop-sample-2:linear:b5921ead84cb','shop-sample-2','linear','b5921ead84cb'),
('shop-sample-2:outline:b5921ead84cb','shop-sample-2','outline','b5921ead84cb'),
('shop-sample-2:bold:b5921ead84cb','shop-sample-2','bold','b5921ead84cb'),
('shop-sample-2:broken:b5921ead84cb','shop-sample-2','broken','b5921ead84cb'),
('shop-sample-2:bulk:b5921ead84cb','shop-sample-2','bulk','b5921ead84cb'),
('shop-sample-2:twotone:b5921ead84cb','shop-sample-2','twotone','b5921ead84cb'),
('shop-sample-3:linear:8b0d910fe2a0','shop-sample-3','linear','8b0d910fe2a0'),
('shop-sample-3:outline:8b0d910fe2a0','shop-sample-3','outline','8b0d910fe2a0'),
('shop-sample-3:bold:8b0d910fe2a0','shop-sample-3','bold','8b0d910fe2a0'),
('shop-sample-3:broken:8b0d910fe2a0','shop-sample-3','broken','8b0d910fe2a0'),
('shop-sample-3:bulk:8b0d910fe2a0','shop-sample-3','bulk','8b0d910fe2a0'),
('shop-sample-3:twotone:8b0d910fe2a0','shop-sample-3','twotone','8b0d910fe2a0'),
('notifications-sample-1:linear:87bf377b15fa','notifications-sample-1','linear','87bf377b15fa'),
('notifications-sample-1:outline:87bf377b15fa','notifications-sample-1','outline','87bf377b15fa'),
('notifications-sample-1:bold:87bf377b15fa','notifications-sample-1','bold','87bf377b15fa'),
('notifications-sample-1:broken:87bf377b15fa','notifications-sample-1','broken','87bf377b15fa'),
('notifications-sample-1:bulk:87bf377b15fa','notifications-sample-1','bulk','87bf377b15fa'),
('notifications-sample-1:twotone:87bf377b15fa','notifications-sample-1','twotone','87bf377b15fa'),
('notifications-sample-2:linear:2ca3d3abfaa2','notifications-sample-2','linear','2ca3d3abfaa2'),
('notifications-sample-2:outline:2ca3d3abfaa2','notifications-sample-2','outline','2ca3d3abfaa2'),
('notifications-sample-2:bold:2ca3d3abfaa2','notifications-sample-2','bold','2ca3d3abfaa2'),
('notifications-sample-2:broken:2ca3d3abfaa2','notifications-sample-2','broken','2ca3d3abfaa2'),
('notifications-sample-2:bulk:2ca3d3abfaa2','notifications-sample-2','bulk','2ca3d3abfaa2'),
('notifications-sample-2:twotone:2ca3d3abfaa2','notifications-sample-2','twotone','2ca3d3abfaa2'),
('notifications-sample-3:linear:e91e1a8d1e15','notifications-sample-3','linear','e91e1a8d1e15'),
('notifications-sample-3:outline:e91e1a8d1e15','notifications-sample-3','outline','e91e1a8d1e15'),
('notifications-sample-3:bold:e91e1a8d1e15','notifications-sample-3','bold','e91e1a8d1e15'),
('notifications-sample-3:broken:e91e1a8d1e15','notifications-sample-3','broken','e91e1a8d1e15'),
('notifications-sample-3:bulk:e91e1a8d1e15','notifications-sample-3','bulk','e91e1a8d1e15'),
('notifications-sample-3:twotone:e91e1a8d1e15','notifications-sample-3','twotone','e91e1a8d1e15'),
('animals-sample-1:linear:aba9d1855f8b','animals-sample-1','linear','aba9d1855f8b'),
('animals-sample-1:outline:aba9d1855f8b','animals-sample-1','outline','aba9d1855f8b'),
('animals-sample-1:bold:aba9d1855f8b','animals-sample-1','bold','aba9d1855f8b'),
('animals-sample-1:broken:aba9d1855f8b','animals-sample-1','broken','aba9d1855f8b'),
('animals-sample-1:bulk:aba9d1855f8b','animals-sample-1','bulk','aba9d1855f8b'),
('animals-sample-1:twotone:aba9d1855f8b','animals-sample-1','twotone','aba9d1855f8b'),
('animals-sample-2:linear:974a30fbce7c','animals-sample-2','linear','974a30fbce7c'),
('animals-sample-2:outline:974a30fbce7c','animals-sample-2','outline','974a30fbce7c'),
('animals-sample-2:bold:974a30fbce7c','animals-sample-2','bold','974a30fbce7c'),
('animals-sample-2:broken:974a30fbce7c','animals-sample-2','broken','974a30fbce7c'),
('animals-sample-2:bulk:974a30fbce7c','animals-sample-2','bulk','974a30fbce7c'),
('animals-sample-2:twotone:974a30fbce7c','animals-sample-2','twotone','974a30fbce7c'),
('animals-sample-3:linear:e9907361097f','animals-sample-3','linear','e9907361097f'),
('animals-sample-3:outline:e9907361097f','animals-sample-3','outline','e9907361097f'),
('animals-sample-3:bold:e9907361097f','animals-sample-3','bold','e9907361097f'),
('animals-sample-3:broken:e9907361097f','animals-sample-3','broken','e9907361097f'),
('animals-sample-3:bulk:e9907361097f','animals-sample-3','bulk','e9907361097f'),
('animals-sample-3:twotone:e9907361097f','animals-sample-3','twotone','e9907361097f'),
('baby-sample-1:linear:9a78fc9a817f','baby-sample-1','linear','9a78fc9a817f'),
('baby-sample-1:outline:9a78fc9a817f','baby-sample-1','outline','9a78fc9a817f'),
('baby-sample-1:bold:9a78fc9a817f','baby-sample-1','bold','9a78fc9a817f'),
('baby-sample-1:broken:9a78fc9a817f','baby-sample-1','broken','9a78fc9a817f'),
('baby-sample-1:bulk:9a78fc9a817f','baby-sample-1','bulk','9a78fc9a817f'),
('baby-sample-1:twotone:9a78fc9a817f','baby-sample-1','twotone','9a78fc9a817f'),
('baby-sample-2:linear:defab04ede6f','baby-sample-2','linear','defab04ede6f'),
('baby-sample-2:outline:defab04ede6f','baby-sample-2','outline','defab04ede6f'),
('baby-sample-2:bold:defab04ede6f','baby-sample-2','bold','defab04ede6f'),
('baby-sample-2:broken:defab04ede6f','baby-sample-2','broken','defab04ede6f'),
('baby-sample-2:bulk:defab04ede6f','baby-sample-2','bulk','defab04ede6f'),
('baby-sample-2:twotone:defab04ede6f','baby-sample-2','twotone','defab04ede6f'),
('baby-sample-3:linear:496b5e3ff3c5','baby-sample-3','linear','496b5e3ff3c5'),
('baby-sample-3:outline:496b5e3ff3c5','baby-sample-3','outline','496b5e3ff3c5'),
('baby-sample-3:bold:496b5e3ff3c5','baby-sample-3','bold','496b5e3ff3c5'),
('baby-sample-3:broken:496b5e3ff3c5','baby-sample-3','broken','496b5e3ff3c5'),
('baby-sample-3:bulk:496b5e3ff3c5','baby-sample-3','bulk','496b5e3ff3c5'),
('baby-sample-3:twotone:496b5e3ff3c5','baby-sample-3','twotone','496b5e3ff3c5'),
('building-sample-1:linear:140c59240f0a','building-sample-1','linear','140c59240f0a'),
('building-sample-1:outline:140c59240f0a','building-sample-1','outline','140c59240f0a'),
('building-sample-1:bold:140c59240f0a','building-sample-1','bold','140c59240f0a'),
('building-sample-1:broken:140c59240f0a','building-sample-1','broken','140c59240f0a'),
('building-sample-1:bulk:140c59240f0a','building-sample-1','bulk','140c59240f0a'),
('building-sample-1:twotone:140c59240f0a','building-sample-1','twotone','140c59240f0a'),
('building-sample-2:linear:799a340d928d','building-sample-2','linear','799a340d928d'),
('building-sample-2:outline:799a340d928d','building-sample-2','outline','799a340d928d'),
('building-sample-2:bold:799a340d928d','building-sample-2','bold','799a340d928d'),
('building-sample-2:broken:799a340d928d','building-sample-2','broken','799a340d928d'),
('building-sample-2:bulk:799a340d928d','building-sample-2','bulk','799a340d928d'),
('building-sample-2:twotone:799a340d928d','building-sample-2','twotone','799a340d928d'),
('building-sample-3:linear:212da4706a58','building-sample-3','linear','212da4706a58'),
('building-sample-3:outline:212da4706a58','building-sample-3','outline','212da4706a58'),
('building-sample-3:bold:212da4706a58','building-sample-3','bold','212da4706a58'),
('building-sample-3:broken:212da4706a58','building-sample-3','broken','212da4706a58'),
('building-sample-3:bulk:212da4706a58','building-sample-3','bulk','212da4706a58'),
('building-sample-3:twotone:212da4706a58','building-sample-3','twotone','212da4706a58'),
('business-sample-1:linear:fd76ae9c36ce','business-sample-1','linear','fd76ae9c36ce'),
('business-sample-1:outline:fd76ae9c36ce','business-sample-1','outline','fd76ae9c36ce'),
('business-sample-1:bold:fd76ae9c36ce','business-sample-1','bold','fd76ae9c36ce'),
('business-sample-1:broken:fd76ae9c36ce','business-sample-1','broken','fd76ae9c36ce'),
('business-sample-1:bulk:fd76ae9c36ce','business-sample-1','bulk','fd76ae9c36ce'),
('business-sample-1:twotone:fd76ae9c36ce','business-sample-1','twotone','fd76ae9c36ce'),
('business-sample-2:linear:a3eca4e26c3b','business-sample-2','linear','a3eca4e26c3b'),
('business-sample-2:outline:a3eca4e26c3b','business-sample-2','outline','a3eca4e26c3b'),
('business-sample-2:bold:a3eca4e26c3b','business-sample-2','bold','a3eca4e26c3b'),
('business-sample-2:broken:a3eca4e26c3b','business-sample-2','broken','a3eca4e26c3b'),
('business-sample-2:bulk:a3eca4e26c3b','business-sample-2','bulk','a3eca4e26c3b'),
('business-sample-2:twotone:a3eca4e26c3b','business-sample-2','twotone','a3eca4e26c3b'),
('business-sample-3:linear:4ce56636ffc2','business-sample-3','linear','4ce56636ffc2'),
('business-sample-3:outline:4ce56636ffc2','business-sample-3','outline','4ce56636ffc2'),
('business-sample-3:bold:4ce56636ffc2','business-sample-3','bold','4ce56636ffc2'),
('business-sample-3:broken:4ce56636ffc2','business-sample-3','broken','4ce56636ffc2'),
('business-sample-3:bulk:4ce56636ffc2','business-sample-3','bulk','4ce56636ffc2'),
('business-sample-3:twotone:4ce56636ffc2','business-sample-3','twotone','4ce56636ffc2'),
('call-sample-1:linear:f47221b76b24','call-sample-1','linear','f47221b76b24'),
('call-sample-1:outline:f47221b76b24','call-sample-1','outline','f47221b76b24'),
('call-sample-1:bold:f47221b76b24','call-sample-1','bold','f47221b76b24'),
('call-sample-1:broken:f47221b76b24','call-sample-1','broken','f47221b76b24'),
('call-sample-1:bulk:f47221b76b24','call-sample-1','bulk','f47221b76b24'),
('call-sample-1:twotone:f47221b76b24','call-sample-1','twotone','f47221b76b24'),
('call-sample-2:linear:aa53375d78d5','call-sample-2','linear','aa53375d78d5'),
('call-sample-2:outline:aa53375d78d5','call-sample-2','outline','aa53375d78d5'),
('call-sample-2:bold:aa53375d78d5','call-sample-2','bold','aa53375d78d5'),
('call-sample-2:broken:aa53375d78d5','call-sample-2','broken','aa53375d78d5'),
('call-sample-2:bulk:aa53375d78d5','call-sample-2','bulk','aa53375d78d5'),
('call-sample-2:twotone:aa53375d78d5','call-sample-2','twotone','aa53375d78d5'),
('call-sample-3:linear:f1ebf31deff7','call-sample-3','linear','f1ebf31deff7'),
('call-sample-3:outline:f1ebf31deff7','call-sample-3','outline','f1ebf31deff7'),
('call-sample-3:bold:f1ebf31deff7','call-sample-3','bold','f1ebf31deff7'),
('call-sample-3:broken:f1ebf31deff7','call-sample-3','broken','f1ebf31deff7'),
('call-sample-3:bulk:f1ebf31deff7','call-sample-3','bulk','f1ebf31deff7'),
('call-sample-3:twotone:f1ebf31deff7','call-sample-3','twotone','f1ebf31deff7'),
('car-sample-1:linear:fbf76f5c75a4','car-sample-1','linear','fbf76f5c75a4'),
('car-sample-1:outline:fbf76f5c75a4','car-sample-1','outline','fbf76f5c75a4'),
('car-sample-1:bold:fbf76f5c75a4','car-sample-1','bold','fbf76f5c75a4'),
('car-sample-1:broken:fbf76f5c75a4','car-sample-1','broken','fbf76f5c75a4'),
('car-sample-1:bulk:fbf76f5c75a4','car-sample-1','bulk','fbf76f5c75a4'),
('car-sample-1:twotone:fbf76f5c75a4','car-sample-1','twotone','fbf76f5c75a4'),
('car-sample-2:linear:5f466a9b6103','car-sample-2','linear','5f466a9b6103'),
('car-sample-2:outline:5f466a9b6103','car-sample-2','outline','5f466a9b6103'),
('car-sample-2:bold:5f466a9b6103','car-sample-2','bold','5f466a9b6103'),
('car-sample-2:broken:5f466a9b6103','car-sample-2','broken','5f466a9b6103'),
('car-sample-2:bulk:5f466a9b6103','car-sample-2','bulk','5f466a9b6103'),
('car-sample-2:twotone:5f466a9b6103','car-sample-2','twotone','5f466a9b6103'),
('car-sample-3:linear:b338e608bf10','car-sample-3','linear','b338e608bf10'),
('car-sample-3:outline:b338e608bf10','car-sample-3','outline','b338e608bf10'),
('car-sample-3:bold:b338e608bf10','car-sample-3','bold','b338e608bf10'),
('car-sample-3:broken:b338e608bf10','car-sample-3','broken','b338e608bf10'),
('car-sample-3:bulk:b338e608bf10','car-sample-3','bulk','b338e608bf10'),
('car-sample-3:twotone:b338e608bf10','car-sample-3','twotone','b338e608bf10'),
('car-service-sample-1:linear:5b61b93ab3b4','car-service-sample-1','linear','5b61b93ab3b4'),
('car-service-sample-1:outline:5b61b93ab3b4','car-service-sample-1','outline','5b61b93ab3b4'),
('car-service-sample-1:bold:5b61b93ab3b4','car-service-sample-1','bold','5b61b93ab3b4'),
('car-service-sample-1:broken:5b61b93ab3b4','car-service-sample-1','broken','5b61b93ab3b4'),
('car-service-sample-1:bulk:5b61b93ab3b4','car-service-sample-1','bulk','5b61b93ab3b4'),
('car-service-sample-1:twotone:5b61b93ab3b4','car-service-sample-1','twotone','5b61b93ab3b4'),
('car-service-sample-2:linear:6273560a739b','car-service-sample-2','linear','6273560a739b'),
('car-service-sample-2:outline:6273560a739b','car-service-sample-2','outline','6273560a739b'),
('car-service-sample-2:bold:6273560a739b','car-service-sample-2','bold','6273560a739b'),
('car-service-sample-2:broken:6273560a739b','car-service-sample-2','broken','6273560a739b'),
('car-service-sample-2:bulk:6273560a739b','car-service-sample-2','bulk','6273560a739b'),
('car-service-sample-2:twotone:6273560a739b','car-service-sample-2','twotone','6273560a739b'),
('car-service-sample-3:linear:3bc76d4ddf52','car-service-sample-3','linear','3bc76d4ddf52'),
('car-service-sample-3:outline:3bc76d4ddf52','car-service-sample-3','outline','3bc76d4ddf52'),
('car-service-sample-3:bold:3bc76d4ddf52','car-service-sample-3','bold','3bc76d4ddf52'),
('car-service-sample-3:broken:3bc76d4ddf52','car-service-sample-3','broken','3bc76d4ddf52'),
('car-service-sample-3:bulk:3bc76d4ddf52','car-service-sample-3','bulk','3bc76d4ddf52'),
('car-service-sample-3:twotone:3bc76d4ddf52','car-service-sample-3','twotone','3bc76d4ddf52'),
('casino-sample-1:linear:9a2f57b0a4ff','casino-sample-1','linear','9a2f57b0a4ff'),
('casino-sample-1:outline:9a2f57b0a4ff','casino-sample-1','outline','9a2f57b0a4ff'),
('casino-sample-1:bold:9a2f57b0a4ff','casino-sample-1','bold','9a2f57b0a4ff'),
('casino-sample-1:broken:9a2f57b0a4ff','casino-sample-1','broken','9a2f57b0a4ff'),
('casino-sample-1:bulk:9a2f57b0a4ff','casino-sample-1','bulk','9a2f57b0a4ff'),
('casino-sample-1:twotone:9a2f57b0a4ff','casino-sample-1','twotone','9a2f57b0a4ff'),
('casino-sample-2:linear:e769eabe019c','casino-sample-2','linear','e769eabe019c'),
('casino-sample-2:outline:e769eabe019c','casino-sample-2','outline','e769eabe019c'),
('casino-sample-2:bold:e769eabe019c','casino-sample-2','bold','e769eabe019c'),
('casino-sample-2:broken:e769eabe019c','casino-sample-2','broken','e769eabe019c'),
('casino-sample-2:bulk:e769eabe019c','casino-sample-2','bulk','e769eabe019c'),
('casino-sample-2:twotone:e769eabe019c','casino-sample-2','twotone','e769eabe019c'),
('casino-sample-3:linear:c7fc98acb50d','casino-sample-3','linear','c7fc98acb50d'),
('casino-sample-3:outline:c7fc98acb50d','casino-sample-3','outline','c7fc98acb50d'),
('casino-sample-3:bold:c7fc98acb50d','casino-sample-3','bold','c7fc98acb50d'),
('casino-sample-3:broken:c7fc98acb50d','casino-sample-3','broken','c7fc98acb50d'),
('casino-sample-3:bulk:c7fc98acb50d','casino-sample-3','bulk','c7fc98acb50d'),
('casino-sample-3:twotone:c7fc98acb50d','casino-sample-3','twotone','c7fc98acb50d'),
('christmas-sample-1:linear:78b299d6dc47','christmas-sample-1','linear','78b299d6dc47'),
('christmas-sample-1:outline:78b299d6dc47','christmas-sample-1','outline','78b299d6dc47'),
('christmas-sample-1:bold:78b299d6dc47','christmas-sample-1','bold','78b299d6dc47'),
('christmas-sample-1:broken:78b299d6dc47','christmas-sample-1','broken','78b299d6dc47'),
('christmas-sample-1:bulk:78b299d6dc47','christmas-sample-1','bulk','78b299d6dc47'),
('christmas-sample-1:twotone:78b299d6dc47','christmas-sample-1','twotone','78b299d6dc47'),
('christmas-sample-2:linear:dc83de257fb3','christmas-sample-2','linear','dc83de257fb3'),
('christmas-sample-2:outline:dc83de257fb3','christmas-sample-2','outline','dc83de257fb3'),
('christmas-sample-2:bold:dc83de257fb3','christmas-sample-2','bold','dc83de257fb3'),
('christmas-sample-2:broken:dc83de257fb3','christmas-sample-2','broken','dc83de257fb3'),
('christmas-sample-2:bulk:dc83de257fb3','christmas-sample-2','bulk','dc83de257fb3'),
('christmas-sample-2:twotone:dc83de257fb3','christmas-sample-2','twotone','dc83de257fb3'),
('christmas-sample-3:linear:cf21fb06b952','christmas-sample-3','linear','cf21fb06b952'),
('christmas-sample-3:outline:cf21fb06b952','christmas-sample-3','outline','cf21fb06b952'),
('christmas-sample-3:bold:cf21fb06b952','christmas-sample-3','bold','cf21fb06b952'),
('christmas-sample-3:broken:cf21fb06b952','christmas-sample-3','broken','cf21fb06b952'),
('christmas-sample-3:bulk:cf21fb06b952','christmas-sample-3','bulk','cf21fb06b952'),
('christmas-sample-3:twotone:cf21fb06b952','christmas-sample-3','twotone','cf21fb06b952'),
('clothes2-sample-1:linear:4cd480908611','clothes2-sample-1','linear','4cd480908611'),
('clothes2-sample-1:outline:4cd480908611','clothes2-sample-1','outline','4cd480908611'),
('clothes2-sample-1:bold:4cd480908611','clothes2-sample-1','bold','4cd480908611'),
('clothes2-sample-1:broken:4cd480908611','clothes2-sample-1','broken','4cd480908611'),
('clothes2-sample-1:bulk:4cd480908611','clothes2-sample-1','bulk','4cd480908611'),
('clothes2-sample-1:twotone:4cd480908611','clothes2-sample-1','twotone','4cd480908611'),
('clothes2-sample-2:linear:eb6827c8c64e','clothes2-sample-2','linear','eb6827c8c64e'),
('clothes2-sample-2:outline:eb6827c8c64e','clothes2-sample-2','outline','eb6827c8c64e'),
('clothes2-sample-2:bold:eb6827c8c64e','clothes2-sample-2','bold','eb6827c8c64e'),
('clothes2-sample-2:broken:eb6827c8c64e','clothes2-sample-2','broken','eb6827c8c64e'),
('clothes2-sample-2:bulk:eb6827c8c64e','clothes2-sample-2','bulk','eb6827c8c64e'),
('clothes2-sample-2:twotone:eb6827c8c64e','clothes2-sample-2','twotone','eb6827c8c64e'),
('clothes2-sample-3:linear:5e268087ac30','clothes2-sample-3','linear','5e268087ac30'),
('clothes2-sample-3:outline:5e268087ac30','clothes2-sample-3','outline','5e268087ac30'),
('clothes2-sample-3:bold:5e268087ac30','clothes2-sample-3','bold','5e268087ac30'),
('clothes2-sample-3:broken:5e268087ac30','clothes2-sample-3','broken','5e268087ac30'),
('clothes2-sample-3:bulk:5e268087ac30','clothes2-sample-3','bulk','5e268087ac30'),
('clothes2-sample-3:twotone:5e268087ac30','clothes2-sample-3','twotone','5e268087ac30'),
('coffe-sample-1:linear:7a44aaadcc2e','coffe-sample-1','linear','7a44aaadcc2e'),
('coffe-sample-1:outline:7a44aaadcc2e','coffe-sample-1','outline','7a44aaadcc2e'),
('coffe-sample-1:bold:7a44aaadcc2e','coffe-sample-1','bold','7a44aaadcc2e'),
('coffe-sample-1:broken:7a44aaadcc2e','coffe-sample-1','broken','7a44aaadcc2e'),
('coffe-sample-1:bulk:7a44aaadcc2e','coffe-sample-1','bulk','7a44aaadcc2e'),
('coffe-sample-1:twotone:7a44aaadcc2e','coffe-sample-1','twotone','7a44aaadcc2e'),
('coffe-sample-2:linear:4b776691c356','coffe-sample-2','linear','4b776691c356'),
('coffe-sample-2:outline:4b776691c356','coffe-sample-2','outline','4b776691c356'),
('coffe-sample-2:bold:4b776691c356','coffe-sample-2','bold','4b776691c356'),
('coffe-sample-2:broken:4b776691c356','coffe-sample-2','broken','4b776691c356'),
('coffe-sample-2:bulk:4b776691c356','coffe-sample-2','bulk','4b776691c356'),
('coffe-sample-2:twotone:4b776691c356','coffe-sample-2','twotone','4b776691c356'),
('coffe-sample-3:linear:553bdfbb4b99','coffe-sample-3','linear','553bdfbb4b99'),
('coffe-sample-3:outline:553bdfbb4b99','coffe-sample-3','outline','553bdfbb4b99'),
('coffe-sample-3:bold:553bdfbb4b99','coffe-sample-3','bold','553bdfbb4b99'),
('coffe-sample-3:broken:553bdfbb4b99','coffe-sample-3','broken','553bdfbb4b99'),
('coffe-sample-3:bulk:553bdfbb4b99','coffe-sample-3','bulk','553bdfbb4b99'),
('coffe-sample-3:twotone:553bdfbb4b99','coffe-sample-3','twotone','553bdfbb4b99'),
('furniture-sample-1:linear:7decfca72186','furniture-sample-1','linear','7decfca72186'),
('furniture-sample-1:outline:7decfca72186','furniture-sample-1','outline','7decfca72186'),
('furniture-sample-1:bold:7decfca72186','furniture-sample-1','bold','7decfca72186'),
('furniture-sample-1:broken:7decfca72186','furniture-sample-1','broken','7decfca72186'),
('furniture-sample-1:bulk:7decfca72186','furniture-sample-1','bulk','7decfca72186'),
('furniture-sample-1:twotone:7decfca72186','furniture-sample-1','twotone','7decfca72186'),
('furniture-sample-2:linear:c4dc3c0d663b','furniture-sample-2','linear','c4dc3c0d663b'),
('furniture-sample-2:outline:c4dc3c0d663b','furniture-sample-2','outline','c4dc3c0d663b'),
('furniture-sample-2:bold:c4dc3c0d663b','furniture-sample-2','bold','c4dc3c0d663b'),
('furniture-sample-2:broken:c4dc3c0d663b','furniture-sample-2','broken','c4dc3c0d663b'),
('furniture-sample-2:bulk:c4dc3c0d663b','furniture-sample-2','bulk','c4dc3c0d663b'),
('furniture-sample-2:twotone:c4dc3c0d663b','furniture-sample-2','twotone','c4dc3c0d663b'),
('furniture-sample-3:linear:1bbb3128d4d2','furniture-sample-3','linear','1bbb3128d4d2'),
('furniture-sample-3:outline:1bbb3128d4d2','furniture-sample-3','outline','1bbb3128d4d2'),
('furniture-sample-3:bold:1bbb3128d4d2','furniture-sample-3','bold','1bbb3128d4d2'),
('furniture-sample-3:broken:1bbb3128d4d2','furniture-sample-3','broken','1bbb3128d4d2'),
('furniture-sample-3:bulk:1bbb3128d4d2','furniture-sample-3','bulk','1bbb3128d4d2'),
('furniture-sample-3:twotone:1bbb3128d4d2','furniture-sample-3','twotone','1bbb3128d4d2'),
('game-sample-1:linear:3161794f95b4','game-sample-1','linear','3161794f95b4'),
('game-sample-1:outline:3161794f95b4','game-sample-1','outline','3161794f95b4'),
('game-sample-1:bold:3161794f95b4','game-sample-1','bold','3161794f95b4'),
('game-sample-1:broken:3161794f95b4','game-sample-1','broken','3161794f95b4'),
('game-sample-1:bulk:3161794f95b4','game-sample-1','bulk','3161794f95b4'),
('game-sample-1:twotone:3161794f95b4','game-sample-1','twotone','3161794f95b4'),
('game-sample-2:linear:a832ad2a4273','game-sample-2','linear','a832ad2a4273'),
('game-sample-2:outline:a832ad2a4273','game-sample-2','outline','a832ad2a4273'),
('game-sample-2:bold:a832ad2a4273','game-sample-2','bold','a832ad2a4273'),
('game-sample-2:broken:a832ad2a4273','game-sample-2','broken','a832ad2a4273'),
('game-sample-2:bulk:a832ad2a4273','game-sample-2','bulk','a832ad2a4273'),
('game-sample-2:twotone:a832ad2a4273','game-sample-2','twotone','a832ad2a4273'),
('game-sample-3:linear:ec22cc62c6b6','game-sample-3','linear','ec22cc62c6b6'),
('game-sample-3:outline:ec22cc62c6b6','game-sample-3','outline','ec22cc62c6b6'),
('game-sample-3:bold:ec22cc62c6b6','game-sample-3','bold','ec22cc62c6b6'),
('game-sample-3:broken:ec22cc62c6b6','game-sample-3','broken','ec22cc62c6b6'),
('game-sample-3:bulk:ec22cc62c6b6','game-sample-3','bulk','ec22cc62c6b6'),
('game-sample-3:twotone:ec22cc62c6b6','game-sample-3','twotone','ec22cc62c6b6'),
('nature-sample-1:linear:8f43b5403b86','nature-sample-1','linear','8f43b5403b86'),
('nature-sample-1:outline:8f43b5403b86','nature-sample-1','outline','8f43b5403b86'),
('nature-sample-1:bold:8f43b5403b86','nature-sample-1','bold','8f43b5403b86'),
('nature-sample-1:broken:8f43b5403b86','nature-sample-1','broken','8f43b5403b86'),
('nature-sample-1:bulk:8f43b5403b86','nature-sample-1','bulk','8f43b5403b86'),
('nature-sample-1:twotone:8f43b5403b86','nature-sample-1','twotone','8f43b5403b86'),
('nature-sample-2:linear:7e04e0e2194d','nature-sample-2','linear','7e04e0e2194d'),
('nature-sample-2:outline:7e04e0e2194d','nature-sample-2','outline','7e04e0e2194d'),
('nature-sample-2:bold:7e04e0e2194d','nature-sample-2','bold','7e04e0e2194d'),
('nature-sample-2:broken:7e04e0e2194d','nature-sample-2','broken','7e04e0e2194d'),
('nature-sample-2:bulk:7e04e0e2194d','nature-sample-2','bulk','7e04e0e2194d'),
('nature-sample-2:twotone:7e04e0e2194d','nature-sample-2','twotone','7e04e0e2194d'),
('nature-sample-3:linear:37627341d8d3','nature-sample-3','linear','37627341d8d3'),
('nature-sample-3:outline:37627341d8d3','nature-sample-3','outline','37627341d8d3'),
('nature-sample-3:bold:37627341d8d3','nature-sample-3','bold','37627341d8d3'),
('nature-sample-3:broken:37627341d8d3','nature-sample-3','broken','37627341d8d3'),
('nature-sample-3:bulk:37627341d8d3','nature-sample-3','bulk','37627341d8d3'),
('nature-sample-3:twotone:37627341d8d3','nature-sample-3','twotone','37627341d8d3'),
('pet-sample-1:linear:ce1ac7002fef','pet-sample-1','linear','ce1ac7002fef'),
('pet-sample-1:outline:ce1ac7002fef','pet-sample-1','outline','ce1ac7002fef'),
('pet-sample-1:bold:ce1ac7002fef','pet-sample-1','bold','ce1ac7002fef'),
('pet-sample-1:broken:ce1ac7002fef','pet-sample-1','broken','ce1ac7002fef'),
('pet-sample-1:bulk:ce1ac7002fef','pet-sample-1','bulk','ce1ac7002fef'),
('pet-sample-1:twotone:ce1ac7002fef','pet-sample-1','twotone','ce1ac7002fef'),
('pet-sample-2:linear:2261e8671182','pet-sample-2','linear','2261e8671182'),
('pet-sample-2:outline:2261e8671182','pet-sample-2','outline','2261e8671182'),
('pet-sample-2:bold:2261e8671182','pet-sample-2','bold','2261e8671182'),
('pet-sample-2:broken:2261e8671182','pet-sample-2','broken','2261e8671182'),
('pet-sample-2:bulk:2261e8671182','pet-sample-2','bulk','2261e8671182'),
('pet-sample-2:twotone:2261e8671182','pet-sample-2','twotone','2261e8671182'),
('pet-sample-3:linear:8cab3859322d','pet-sample-3','linear','8cab3859322d'),
('pet-sample-3:outline:8cab3859322d','pet-sample-3','outline','8cab3859322d'),
('pet-sample-3:bold:8cab3859322d','pet-sample-3','bold','8cab3859322d'),
('pet-sample-3:broken:8cab3859322d','pet-sample-3','broken','8cab3859322d'),
('pet-sample-3:bulk:8cab3859322d','pet-sample-3','bulk','8cab3859322d'),
('pet-sample-3:twotone:8cab3859322d','pet-sample-3','twotone','8cab3859322d'),
('travel-sample-1:linear:82d5c9700f41','travel-sample-1','linear','82d5c9700f41'),
('travel-sample-1:outline:82d5c9700f41','travel-sample-1','outline','82d5c9700f41'),
('travel-sample-1:bold:82d5c9700f41','travel-sample-1','bold','82d5c9700f41'),
('travel-sample-1:broken:82d5c9700f41','travel-sample-1','broken','82d5c9700f41'),
('travel-sample-1:bulk:82d5c9700f41','travel-sample-1','bulk','82d5c9700f41'),
('travel-sample-1:twotone:82d5c9700f41','travel-sample-1','twotone','82d5c9700f41'),
('travel-sample-2:linear:9af423b1a135','travel-sample-2','linear','9af423b1a135'),
('travel-sample-2:outline:9af423b1a135','travel-sample-2','outline','9af423b1a135'),
('travel-sample-2:bold:9af423b1a135','travel-sample-2','bold','9af423b1a135'),
('travel-sample-2:broken:9af423b1a135','travel-sample-2','broken','9af423b1a135'),
('travel-sample-2:bulk:9af423b1a135','travel-sample-2','bulk','9af423b1a135'),
('travel-sample-2:twotone:9af423b1a135','travel-sample-2','twotone','9af423b1a135'),
('travel-sample-3:linear:a31d6d388981','travel-sample-3','linear','a31d6d388981'),
('travel-sample-3:outline:a31d6d388981','travel-sample-3','outline','a31d6d388981'),
('travel-sample-3:bold:a31d6d388981','travel-sample-3','bold','a31d6d388981'),
('travel-sample-3:broken:a31d6d388981','travel-sample-3','broken','a31d6d388981'),
('travel-sample-3:bulk:a31d6d388981','travel-sample-3','bulk','a31d6d388981'),
('travel-sample-3:twotone:a31d6d388981','travel-sample-3','twotone','a31d6d388981'),
('delivery-sample-1:linear:174bd62b4c2d','delivery-sample-1','linear','174bd62b4c2d'),
('delivery-sample-1:outline:174bd62b4c2d','delivery-sample-1','outline','174bd62b4c2d'),
('delivery-sample-1:bold:174bd62b4c2d','delivery-sample-1','bold','174bd62b4c2d'),
('delivery-sample-1:broken:174bd62b4c2d','delivery-sample-1','broken','174bd62b4c2d'),
('delivery-sample-1:bulk:174bd62b4c2d','delivery-sample-1','bulk','174bd62b4c2d'),
('delivery-sample-1:twotone:174bd62b4c2d','delivery-sample-1','twotone','174bd62b4c2d'),
('delivery-sample-2:linear:d987aa78724d','delivery-sample-2','linear','d987aa78724d'),
('delivery-sample-2:outline:d987aa78724d','delivery-sample-2','outline','d987aa78724d'),
('delivery-sample-2:bold:d987aa78724d','delivery-sample-2','bold','d987aa78724d'),
('delivery-sample-2:broken:d987aa78724d','delivery-sample-2','broken','d987aa78724d'),
('delivery-sample-2:bulk:d987aa78724d','delivery-sample-2','bulk','d987aa78724d'),
('delivery-sample-2:twotone:d987aa78724d','delivery-sample-2','twotone','d987aa78724d'),
('delivery-sample-3:linear:3fbd7ffa4929','delivery-sample-3','linear','3fbd7ffa4929'),
('delivery-sample-3:outline:3fbd7ffa4929','delivery-sample-3','outline','3fbd7ffa4929'),
('delivery-sample-3:bold:3fbd7ffa4929','delivery-sample-3','bold','3fbd7ffa4929'),
('delivery-sample-3:broken:3fbd7ffa4929','delivery-sample-3','broken','3fbd7ffa4929'),
('delivery-sample-3:bulk:3fbd7ffa4929','delivery-sample-3','bulk','3fbd7ffa4929'),
('delivery-sample-3:twotone:3fbd7ffa4929','delivery-sample-3','twotone','3fbd7ffa4929'),
('design-tools-sample-1:linear:a17c62695cce','design-tools-sample-1','linear','a17c62695cce'),
('design-tools-sample-1:outline:a17c62695cce','design-tools-sample-1','outline','a17c62695cce'),
('design-tools-sample-1:bold:a17c62695cce','design-tools-sample-1','bold','a17c62695cce'),
('design-tools-sample-1:broken:a17c62695cce','design-tools-sample-1','broken','a17c62695cce'),
('design-tools-sample-1:bulk:a17c62695cce','design-tools-sample-1','bulk','a17c62695cce'),
('design-tools-sample-1:twotone:a17c62695cce','design-tools-sample-1','twotone','a17c62695cce'),
('design-tools-sample-2:linear:2871e465028e','design-tools-sample-2','linear','2871e465028e'),
('design-tools-sample-2:outline:2871e465028e','design-tools-sample-2','outline','2871e465028e'),
('design-tools-sample-2:bold:2871e465028e','design-tools-sample-2','bold','2871e465028e'),
('design-tools-sample-2:broken:2871e465028e','design-tools-sample-2','broken','2871e465028e'),
('design-tools-sample-2:bulk:2871e465028e','design-tools-sample-2','bulk','2871e465028e'),
('design-tools-sample-2:twotone:2871e465028e','design-tools-sample-2','twotone','2871e465028e'),
('design-tools-sample-3:linear:9a1ff7b53d24','design-tools-sample-3','linear','9a1ff7b53d24'),
('design-tools-sample-3:outline:9a1ff7b53d24','design-tools-sample-3','outline','9a1ff7b53d24'),
('design-tools-sample-3:bold:9a1ff7b53d24','design-tools-sample-3','bold','9a1ff7b53d24'),
('design-tools-sample-3:broken:9a1ff7b53d24','design-tools-sample-3','broken','9a1ff7b53d24'),
('design-tools-sample-3:bulk:9a1ff7b53d24','design-tools-sample-3','bulk','9a1ff7b53d24'),
('design-tools-sample-3:twotone:9a1ff7b53d24','design-tools-sample-3','twotone','9a1ff7b53d24'),
('device-sample-1:linear:8389d2fffd53','device-sample-1','linear','8389d2fffd53'),
('device-sample-1:outline:8389d2fffd53','device-sample-1','outline','8389d2fffd53'),
('device-sample-1:bold:8389d2fffd53','device-sample-1','bold','8389d2fffd53'),
('device-sample-1:broken:8389d2fffd53','device-sample-1','broken','8389d2fffd53'),
('device-sample-1:bulk:8389d2fffd53','device-sample-1','bulk','8389d2fffd53'),
('device-sample-1:twotone:8389d2fffd53','device-sample-1','twotone','8389d2fffd53'),
('device-sample-2:linear:69ad27479a86','device-sample-2','linear','69ad27479a86'),
('device-sample-2:outline:69ad27479a86','device-sample-2','outline','69ad27479a86'),
('device-sample-2:bold:69ad27479a86','device-sample-2','bold','69ad27479a86'),
('device-sample-2:broken:69ad27479a86','device-sample-2','broken','69ad27479a86'),
('device-sample-2:bulk:69ad27479a86','device-sample-2','bulk','69ad27479a86'),
('device-sample-2:twotone:69ad27479a86','device-sample-2','twotone','69ad27479a86'),
('device-sample-3:linear:64c17b457517','device-sample-3','linear','64c17b457517'),
('device-sample-3:outline:64c17b457517','device-sample-3','outline','64c17b457517'),
('device-sample-3:bold:64c17b457517','device-sample-3','bold','64c17b457517'),
('device-sample-3:broken:64c17b457517','device-sample-3','broken','64c17b457517'),
('device-sample-3:bulk:64c17b457517','device-sample-3','bulk','64c17b457517'),
('device-sample-3:twotone:64c17b457517','device-sample-3','twotone','64c17b457517'),
('devices-sample-1:linear:7b06029fae74','devices-sample-1','linear','7b06029fae74'),
('devices-sample-1:outline:7b06029fae74','devices-sample-1','outline','7b06029fae74'),
('devices-sample-1:bold:7b06029fae74','devices-sample-1','bold','7b06029fae74'),
('devices-sample-1:broken:7b06029fae74','devices-sample-1','broken','7b06029fae74'),
('devices-sample-1:bulk:7b06029fae74','devices-sample-1','bulk','7b06029fae74'),
('devices-sample-1:twotone:7b06029fae74','devices-sample-1','twotone','7b06029fae74'),
('devices-sample-2:linear:ac53172a4e3e','devices-sample-2','linear','ac53172a4e3e'),
('devices-sample-2:outline:ac53172a4e3e','devices-sample-2','outline','ac53172a4e3e'),
('devices-sample-2:bold:ac53172a4e3e','devices-sample-2','bold','ac53172a4e3e'),
('devices-sample-2:broken:ac53172a4e3e','devices-sample-2','broken','ac53172a4e3e'),
('devices-sample-2:bulk:ac53172a4e3e','devices-sample-2','bulk','ac53172a4e3e'),
('devices-sample-2:twotone:ac53172a4e3e','devices-sample-2','twotone','ac53172a4e3e'),
('devices-sample-3:linear:0e67f7d8938b','devices-sample-3','linear','0e67f7d8938b'),
('devices-sample-3:outline:0e67f7d8938b','devices-sample-3','outline','0e67f7d8938b'),
('devices-sample-3:bold:0e67f7d8938b','devices-sample-3','bold','0e67f7d8938b'),
('devices-sample-3:broken:0e67f7d8938b','devices-sample-3','broken','0e67f7d8938b'),
('devices-sample-3:bulk:0e67f7d8938b','devices-sample-3','bulk','0e67f7d8938b'),
('devices-sample-3:twotone:0e67f7d8938b','devices-sample-3','twotone','0e67f7d8938b'),
('fitness-sample-1:linear:4237fc09329e','fitness-sample-1','linear','4237fc09329e'),
('fitness-sample-1:outline:4237fc09329e','fitness-sample-1','outline','4237fc09329e'),
('fitness-sample-1:bold:4237fc09329e','fitness-sample-1','bold','4237fc09329e'),
('fitness-sample-1:broken:4237fc09329e','fitness-sample-1','broken','4237fc09329e'),
('fitness-sample-1:bulk:4237fc09329e','fitness-sample-1','bulk','4237fc09329e'),
('fitness-sample-1:twotone:4237fc09329e','fitness-sample-1','twotone','4237fc09329e'),
('fitness-sample-2:linear:5afcdb4d9a31','fitness-sample-2','linear','5afcdb4d9a31'),
('fitness-sample-2:outline:5afcdb4d9a31','fitness-sample-2','outline','5afcdb4d9a31'),
('fitness-sample-2:bold:5afcdb4d9a31','fitness-sample-2','bold','5afcdb4d9a31'),
('fitness-sample-2:broken:5afcdb4d9a31','fitness-sample-2','broken','5afcdb4d9a31'),
('fitness-sample-2:bulk:5afcdb4d9a31','fitness-sample-2','bulk','5afcdb4d9a31'),
('fitness-sample-2:twotone:5afcdb4d9a31','fitness-sample-2','twotone','5afcdb4d9a31'),
('fitness-sample-3:linear:5137a5f3295a','fitness-sample-3','linear','5137a5f3295a'),
('fitness-sample-3:outline:5137a5f3295a','fitness-sample-3','outline','5137a5f3295a'),
('fitness-sample-3:bold:5137a5f3295a','fitness-sample-3','bold','5137a5f3295a'),
('fitness-sample-3:broken:5137a5f3295a','fitness-sample-3','broken','5137a5f3295a'),
('fitness-sample-3:bulk:5137a5f3295a','fitness-sample-3','bulk','5137a5f3295a'),
('fitness-sample-3:twotone:5137a5f3295a','fitness-sample-3','twotone','5137a5f3295a'),
('food2-sample-1:linear:4e3ab87cc4bf','food2-sample-1','linear','4e3ab87cc4bf'),
('food2-sample-1:outline:4e3ab87cc4bf','food2-sample-1','outline','4e3ab87cc4bf'),
('food2-sample-1:bold:4e3ab87cc4bf','food2-sample-1','bold','4e3ab87cc4bf'),
('food2-sample-1:broken:4e3ab87cc4bf','food2-sample-1','broken','4e3ab87cc4bf'),
('food2-sample-1:bulk:4e3ab87cc4bf','food2-sample-1','bulk','4e3ab87cc4bf'),
('food2-sample-1:twotone:4e3ab87cc4bf','food2-sample-1','twotone','4e3ab87cc4bf'),
('food2-sample-2:linear:e76a17c1ece8','food2-sample-2','linear','e76a17c1ece8'),
('food2-sample-2:outline:e76a17c1ece8','food2-sample-2','outline','e76a17c1ece8'),
('food2-sample-2:bold:e76a17c1ece8','food2-sample-2','bold','e76a17c1ece8'),
('food2-sample-2:broken:e76a17c1ece8','food2-sample-2','broken','e76a17c1ece8'),
('food2-sample-2:bulk:e76a17c1ece8','food2-sample-2','bulk','e76a17c1ece8'),
('food2-sample-2:twotone:e76a17c1ece8','food2-sample-2','twotone','e76a17c1ece8'),
('food2-sample-3:linear:96b1e1e7a4a1','food2-sample-3','linear','96b1e1e7a4a1'),
('food2-sample-3:outline:96b1e1e7a4a1','food2-sample-3','outline','96b1e1e7a4a1'),
('food2-sample-3:bold:96b1e1e7a4a1','food2-sample-3','bold','96b1e1e7a4a1'),
('food2-sample-3:broken:96b1e1e7a4a1','food2-sample-3','broken','96b1e1e7a4a1'),
('food2-sample-3:bulk:96b1e1e7a4a1','food2-sample-3','bulk','96b1e1e7a4a1'),
('food2-sample-3:twotone:96b1e1e7a4a1','food2-sample-3','twotone','96b1e1e7a4a1'),
('halloween-sample-1:linear:39544a2bf407','halloween-sample-1','linear','39544a2bf407'),
('halloween-sample-1:outline:39544a2bf407','halloween-sample-1','outline','39544a2bf407'),
('halloween-sample-1:bold:39544a2bf407','halloween-sample-1','bold','39544a2bf407'),
('halloween-sample-1:broken:39544a2bf407','halloween-sample-1','broken','39544a2bf407'),
('halloween-sample-1:bulk:39544a2bf407','halloween-sample-1','bulk','39544a2bf407'),
('halloween-sample-1:twotone:39544a2bf407','halloween-sample-1','twotone','39544a2bf407'),
('halloween-sample-2:linear:c59ca616eb31','halloween-sample-2','linear','c59ca616eb31'),
('halloween-sample-2:outline:c59ca616eb31','halloween-sample-2','outline','c59ca616eb31'),
('halloween-sample-2:bold:c59ca616eb31','halloween-sample-2','bold','c59ca616eb31'),
('halloween-sample-2:broken:c59ca616eb31','halloween-sample-2','broken','c59ca616eb31'),
('halloween-sample-2:bulk:c59ca616eb31','halloween-sample-2','bulk','c59ca616eb31'),
('halloween-sample-2:twotone:c59ca616eb31','halloween-sample-2','twotone','c59ca616eb31'),
('halloween-sample-3:linear:72ba69b48758','halloween-sample-3','linear','72ba69b48758'),
('halloween-sample-3:outline:72ba69b48758','halloween-sample-3','outline','72ba69b48758'),
('halloween-sample-3:bold:72ba69b48758','halloween-sample-3','bold','72ba69b48758'),
('halloween-sample-3:broken:72ba69b48758','halloween-sample-3','broken','72ba69b48758'),
('halloween-sample-3:bulk:72ba69b48758','halloween-sample-3','bulk','72ba69b48758'),
('halloween-sample-3:twotone:72ba69b48758','halloween-sample-3','twotone','72ba69b48758'),
('network-sample-1:linear:95d39109c836','network-sample-1','linear','95d39109c836'),
('network-sample-1:outline:95d39109c836','network-sample-1','outline','95d39109c836'),
('network-sample-1:bold:95d39109c836','network-sample-1','bold','95d39109c836'),
('network-sample-1:broken:95d39109c836','network-sample-1','broken','95d39109c836'),
('network-sample-1:bulk:95d39109c836','network-sample-1','bulk','95d39109c836'),
('network-sample-1:twotone:95d39109c836','network-sample-1','twotone','95d39109c836'),
('network-sample-2:linear:001271e108a9','network-sample-2','linear','001271e108a9'),
('network-sample-2:outline:001271e108a9','network-sample-2','outline','001271e108a9'),
('network-sample-2:bold:001271e108a9','network-sample-2','bold','001271e108a9'),
('network-sample-2:broken:001271e108a9','network-sample-2','broken','001271e108a9'),
('network-sample-2:bulk:001271e108a9','network-sample-2','bulk','001271e108a9'),
('network-sample-2:twotone:001271e108a9','network-sample-2','twotone','001271e108a9'),
('network-sample-3:linear:907d17325fc8','network-sample-3','linear','907d17325fc8'),
('network-sample-3:outline:907d17325fc8','network-sample-3','outline','907d17325fc8'),
('network-sample-3:bold:907d17325fc8','network-sample-3','bold','907d17325fc8'),
('network-sample-3:broken:907d17325fc8','network-sample-3','broken','907d17325fc8'),
('network-sample-3:bulk:907d17325fc8','network-sample-3','bulk','907d17325fc8'),
('network-sample-3:twotone:907d17325fc8','network-sample-3','twotone','907d17325fc8'),
('ecology-sample-1:linear:c408a414e2d1','ecology-sample-1','linear','c408a414e2d1'),
('ecology-sample-1:outline:c408a414e2d1','ecology-sample-1','outline','c408a414e2d1'),
('ecology-sample-1:bold:c408a414e2d1','ecology-sample-1','bold','c408a414e2d1'),
('ecology-sample-1:broken:c408a414e2d1','ecology-sample-1','broken','c408a414e2d1'),
('ecology-sample-1:bulk:c408a414e2d1','ecology-sample-1','bulk','c408a414e2d1'),
('ecology-sample-1:twotone:c408a414e2d1','ecology-sample-1','twotone','c408a414e2d1'),
('ecology-sample-2:linear:98eb27e93c87','ecology-sample-2','linear','98eb27e93c87'),
('ecology-sample-2:outline:98eb27e93c87','ecology-sample-2','outline','98eb27e93c87'),
('ecology-sample-2:bold:98eb27e93c87','ecology-sample-2','bold','98eb27e93c87'),
('ecology-sample-2:broken:98eb27e93c87','ecology-sample-2','broken','98eb27e93c87'),
('ecology-sample-2:bulk:98eb27e93c87','ecology-sample-2','bulk','98eb27e93c87'),
('ecology-sample-2:twotone:98eb27e93c87','ecology-sample-2','twotone','98eb27e93c87'),
('ecology-sample-3:linear:59b1097fffa1','ecology-sample-3','linear','59b1097fffa1'),
('ecology-sample-3:outline:59b1097fffa1','ecology-sample-3','outline','59b1097fffa1'),
('ecology-sample-3:bold:59b1097fffa1','ecology-sample-3','bold','59b1097fffa1'),
('ecology-sample-3:broken:59b1097fffa1','ecology-sample-3','broken','59b1097fffa1'),
('ecology-sample-3:bulk:59b1097fffa1','ecology-sample-3','bulk','59b1097fffa1'),
('ecology-sample-3:twotone:59b1097fffa1','ecology-sample-3','twotone','59b1097fffa1'),
('health-sample-1:linear:0482c5b8b212','health-sample-1','linear','0482c5b8b212'),
('health-sample-1:outline:0482c5b8b212','health-sample-1','outline','0482c5b8b212'),
('health-sample-1:bold:0482c5b8b212','health-sample-1','bold','0482c5b8b212'),
('health-sample-1:broken:0482c5b8b212','health-sample-1','broken','0482c5b8b212'),
('health-sample-1:bulk:0482c5b8b212','health-sample-1','bulk','0482c5b8b212'),
('health-sample-1:twotone:0482c5b8b212','health-sample-1','twotone','0482c5b8b212'),
('health-sample-2:linear:3e3df56b6579','health-sample-2','linear','3e3df56b6579'),
('health-sample-2:outline:3e3df56b6579','health-sample-2','outline','3e3df56b6579'),
('health-sample-2:bold:3e3df56b6579','health-sample-2','bold','3e3df56b6579'),
('health-sample-2:broken:3e3df56b6579','health-sample-2','broken','3e3df56b6579'),
('health-sample-2:bulk:3e3df56b6579','health-sample-2','bulk','3e3df56b6579'),
('health-sample-2:twotone:3e3df56b6579','health-sample-2','twotone','3e3df56b6579'),
('health-sample-3:linear:9c09d7be7339','health-sample-3','linear','9c09d7be7339'),
('health-sample-3:outline:9c09d7be7339','health-sample-3','outline','9c09d7be7339'),
('health-sample-3:bold:9c09d7be7339','health-sample-3','bold','9c09d7be7339'),
('health-sample-3:broken:9c09d7be7339','health-sample-3','broken','9c09d7be7339'),
('health-sample-3:bulk:9c09d7be7339','health-sample-3','bulk','9c09d7be7339'),
('health-sample-3:twotone:9c09d7be7339','health-sample-3','twotone','9c09d7be7339'),
('landmarks-sample-1:linear:186af59e16af','landmarks-sample-1','linear','186af59e16af'),
('landmarks-sample-1:outline:186af59e16af','landmarks-sample-1','outline','186af59e16af'),
('landmarks-sample-1:bold:186af59e16af','landmarks-sample-1','bold','186af59e16af'),
('landmarks-sample-1:broken:186af59e16af','landmarks-sample-1','broken','186af59e16af'),
('landmarks-sample-1:bulk:186af59e16af','landmarks-sample-1','bulk','186af59e16af'),
('landmarks-sample-1:twotone:186af59e16af','landmarks-sample-1','twotone','186af59e16af'),
('landmarks-sample-2:linear:824378163366','landmarks-sample-2','linear','824378163366'),
('landmarks-sample-2:outline:824378163366','landmarks-sample-2','outline','824378163366'),
('landmarks-sample-2:bold:824378163366','landmarks-sample-2','bold','824378163366'),
('landmarks-sample-2:broken:824378163366','landmarks-sample-2','broken','824378163366'),
('landmarks-sample-2:bulk:824378163366','landmarks-sample-2','bulk','824378163366'),
('landmarks-sample-2:twotone:824378163366','landmarks-sample-2','twotone','824378163366'),
('landmarks-sample-3:linear:c40e600cc6d6','landmarks-sample-3','linear','c40e600cc6d6'),
('landmarks-sample-3:outline:c40e600cc6d6','landmarks-sample-3','outline','c40e600cc6d6'),
('landmarks-sample-3:bold:c40e600cc6d6','landmarks-sample-3','bold','c40e600cc6d6'),
('landmarks-sample-3:broken:c40e600cc6d6','landmarks-sample-3','broken','c40e600cc6d6'),
('landmarks-sample-3:bulk:c40e600cc6d6','landmarks-sample-3','bulk','c40e600cc6d6'),
('landmarks-sample-3:twotone:c40e600cc6d6','landmarks-sample-3','twotone','c40e600cc6d6'),
('military-sample-1:linear:15eb87bd35f9','military-sample-1','linear','15eb87bd35f9'),
('military-sample-1:outline:15eb87bd35f9','military-sample-1','outline','15eb87bd35f9'),
('military-sample-1:bold:15eb87bd35f9','military-sample-1','bold','15eb87bd35f9'),
('military-sample-1:broken:15eb87bd35f9','military-sample-1','broken','15eb87bd35f9'),
('military-sample-1:bulk:15eb87bd35f9','military-sample-1','bulk','15eb87bd35f9'),
('military-sample-1:twotone:15eb87bd35f9','military-sample-1','twotone','15eb87bd35f9'),
('military-sample-2:linear:f9ef1d56ce39','military-sample-2','linear','f9ef1d56ce39'),
('military-sample-2:outline:f9ef1d56ce39','military-sample-2','outline','f9ef1d56ce39'),
('military-sample-2:bold:f9ef1d56ce39','military-sample-2','bold','f9ef1d56ce39'),
('military-sample-2:broken:f9ef1d56ce39','military-sample-2','broken','f9ef1d56ce39'),
('military-sample-2:bulk:f9ef1d56ce39','military-sample-2','bulk','f9ef1d56ce39'),
('military-sample-2:twotone:f9ef1d56ce39','military-sample-2','twotone','f9ef1d56ce39'),
('military-sample-3:linear:7ee014da8004','military-sample-3','linear','7ee014da8004'),
('military-sample-3:outline:7ee014da8004','military-sample-3','outline','7ee014da8004'),
('military-sample-3:bold:7ee014da8004','military-sample-3','bold','7ee014da8004'),
('military-sample-3:broken:7ee014da8004','military-sample-3','broken','7ee014da8004'),
('military-sample-3:bulk:7ee014da8004','military-sample-3','bulk','7ee014da8004'),
('military-sample-3:twotone:7ee014da8004','military-sample-3','twotone','7ee014da8004'),
('mobile-sample-1:linear:95f09c0786a2','mobile-sample-1','linear','95f09c0786a2'),
('mobile-sample-1:outline:95f09c0786a2','mobile-sample-1','outline','95f09c0786a2'),
('mobile-sample-1:bold:95f09c0786a2','mobile-sample-1','bold','95f09c0786a2'),
('mobile-sample-1:broken:95f09c0786a2','mobile-sample-1','broken','95f09c0786a2'),
('mobile-sample-1:bulk:95f09c0786a2','mobile-sample-1','bulk','95f09c0786a2'),
('mobile-sample-1:twotone:95f09c0786a2','mobile-sample-1','twotone','95f09c0786a2'),
('mobile-sample-2:linear:9f92ef19a6b1','mobile-sample-2','linear','9f92ef19a6b1'),
('mobile-sample-2:outline:9f92ef19a6b1','mobile-sample-2','outline','9f92ef19a6b1'),
('mobile-sample-2:bold:9f92ef19a6b1','mobile-sample-2','bold','9f92ef19a6b1'),
('mobile-sample-2:broken:9f92ef19a6b1','mobile-sample-2','broken','9f92ef19a6b1'),
('mobile-sample-2:bulk:9f92ef19a6b1','mobile-sample-2','bulk','9f92ef19a6b1'),
('mobile-sample-2:twotone:9f92ef19a6b1','mobile-sample-2','twotone','9f92ef19a6b1'),
('mobile-sample-3:linear:e58278629392','mobile-sample-3','linear','e58278629392'),
('mobile-sample-3:outline:e58278629392','mobile-sample-3','outline','e58278629392'),
('mobile-sample-3:bold:e58278629392','mobile-sample-3','bold','e58278629392'),
('mobile-sample-3:broken:e58278629392','mobile-sample-3','broken','e58278629392'),
('mobile-sample-3:bulk:e58278629392','mobile-sample-3','bulk','e58278629392'),
('mobile-sample-3:twotone:e58278629392','mobile-sample-3','twotone','e58278629392'),
('tools-sample-1:linear:2e7e30aecc30','tools-sample-1','linear','2e7e30aecc30'),
('tools-sample-1:outline:2e7e30aecc30','tools-sample-1','outline','2e7e30aecc30'),
('tools-sample-1:bold:2e7e30aecc30','tools-sample-1','bold','2e7e30aecc30'),
('tools-sample-1:broken:2e7e30aecc30','tools-sample-1','broken','2e7e30aecc30'),
('tools-sample-1:bulk:2e7e30aecc30','tools-sample-1','bulk','2e7e30aecc30'),
('tools-sample-1:twotone:2e7e30aecc30','tools-sample-1','twotone','2e7e30aecc30'),
('tools-sample-2:linear:d3ca8dbd67cb','tools-sample-2','linear','d3ca8dbd67cb'),
('tools-sample-2:outline:d3ca8dbd67cb','tools-sample-2','outline','d3ca8dbd67cb'),
('tools-sample-2:bold:d3ca8dbd67cb','tools-sample-2','bold','d3ca8dbd67cb'),
('tools-sample-2:broken:d3ca8dbd67cb','tools-sample-2','broken','d3ca8dbd67cb'),
('tools-sample-2:bulk:d3ca8dbd67cb','tools-sample-2','bulk','d3ca8dbd67cb'),
('tools-sample-2:twotone:d3ca8dbd67cb','tools-sample-2','twotone','d3ca8dbd67cb'),
('tools-sample-3:linear:5091df7c73ac','tools-sample-3','linear','5091df7c73ac'),
('tools-sample-3:outline:5091df7c73ac','tools-sample-3','outline','5091df7c73ac'),
('tools-sample-3:bold:5091df7c73ac','tools-sample-3','bold','5091df7c73ac'),
('tools-sample-3:broken:5091df7c73ac','tools-sample-3','broken','5091df7c73ac'),
('tools-sample-3:bulk:5091df7c73ac','tools-sample-3','bulk','5091df7c73ac'),
('tools-sample-3:twotone:5091df7c73ac','tools-sample-3','twotone','5091df7c73ac'),
('video-sample-1:linear:3b471b2d38c8','video-sample-1','linear','3b471b2d38c8'),
('video-sample-1:outline:3b471b2d38c8','video-sample-1','outline','3b471b2d38c8'),
('video-sample-1:bold:3b471b2d38c8','video-sample-1','bold','3b471b2d38c8'),
('video-sample-1:broken:3b471b2d38c8','video-sample-1','broken','3b471b2d38c8'),
('video-sample-1:bulk:3b471b2d38c8','video-sample-1','bulk','3b471b2d38c8'),
('video-sample-1:twotone:3b471b2d38c8','video-sample-1','twotone','3b471b2d38c8'),
('video-sample-2:linear:488de8a1d448','video-sample-2','linear','488de8a1d448'),
('video-sample-2:outline:488de8a1d448','video-sample-2','outline','488de8a1d448'),
('video-sample-2:bold:488de8a1d448','video-sample-2','bold','488de8a1d448'),
('video-sample-2:broken:488de8a1d448','video-sample-2','broken','488de8a1d448'),
('video-sample-2:bulk:488de8a1d448','video-sample-2','bulk','488de8a1d448'),
('video-sample-2:twotone:488de8a1d448','video-sample-2','twotone','488de8a1d448'),
('video-sample-3:linear:9787afa5fecf','video-sample-3','linear','9787afa5fecf'),
('video-sample-3:outline:9787afa5fecf','video-sample-3','outline','9787afa5fecf'),
('video-sample-3:bold:9787afa5fecf','video-sample-3','bold','9787afa5fecf'),
('video-sample-3:broken:9787afa5fecf','video-sample-3','broken','9787afa5fecf'),
('video-sample-3:bulk:9787afa5fecf','video-sample-3','bulk','9787afa5fecf'),
('video-sample-3:twotone:9787afa5fecf','video-sample-3','twotone','9787afa5fecf'),
('video-audio-image-sample-1:linear:9834df16be7a','video-audio-image-sample-1','linear','9834df16be7a'),
('video-audio-image-sample-1:outline:9834df16be7a','video-audio-image-sample-1','outline','9834df16be7a'),
('video-audio-image-sample-1:bold:9834df16be7a','video-audio-image-sample-1','bold','9834df16be7a'),
('video-audio-image-sample-1:broken:9834df16be7a','video-audio-image-sample-1','broken','9834df16be7a'),
('video-audio-image-sample-1:bulk:9834df16be7a','video-audio-image-sample-1','bulk','9834df16be7a'),
('video-audio-image-sample-1:twotone:9834df16be7a','video-audio-image-sample-1','twotone','9834df16be7a'),
('video-audio-image-sample-2:linear:a8a518bd05dc','video-audio-image-sample-2','linear','a8a518bd05dc'),
('video-audio-image-sample-2:outline:a8a518bd05dc','video-audio-image-sample-2','outline','a8a518bd05dc'),
('video-audio-image-sample-2:bold:a8a518bd05dc','video-audio-image-sample-2','bold','a8a518bd05dc'),
('video-audio-image-sample-2:broken:a8a518bd05dc','video-audio-image-sample-2','broken','a8a518bd05dc'),
('video-audio-image-sample-2:bulk:a8a518bd05dc','video-audio-image-sample-2','bulk','a8a518bd05dc'),
('video-audio-image-sample-2:twotone:a8a518bd05dc','video-audio-image-sample-2','twotone','a8a518bd05dc'),
('video-audio-image-sample-3:linear:653275f2ad8a','video-audio-image-sample-3','linear','653275f2ad8a'),
('video-audio-image-sample-3:outline:653275f2ad8a','video-audio-image-sample-3','outline','653275f2ad8a'),
('video-audio-image-sample-3:bold:653275f2ad8a','video-audio-image-sample-3','bold','653275f2ad8a'),
('video-audio-image-sample-3:broken:653275f2ad8a','video-audio-image-sample-3','broken','653275f2ad8a'),
('video-audio-image-sample-3:bulk:653275f2ad8a','video-audio-image-sample-3','bulk','653275f2ad8a'),
('video-audio-image-sample-3:twotone:653275f2ad8a','video-audio-image-sample-3','twotone','653275f2ad8a'),
('space-sample-1:linear:898f6c0fe71a','space-sample-1','linear','898f6c0fe71a'),
('space-sample-1:outline:898f6c0fe71a','space-sample-1','outline','898f6c0fe71a'),
('space-sample-1:bold:898f6c0fe71a','space-sample-1','bold','898f6c0fe71a'),
('space-sample-1:broken:898f6c0fe71a','space-sample-1','broken','898f6c0fe71a'),
('space-sample-1:bulk:898f6c0fe71a','space-sample-1','bulk','898f6c0fe71a'),
('space-sample-1:twotone:898f6c0fe71a','space-sample-1','twotone','898f6c0fe71a'),
('space-sample-2:linear:a20538c761df','space-sample-2','linear','a20538c761df'),
('space-sample-2:outline:a20538c761df','space-sample-2','outline','a20538c761df'),
('space-sample-2:bold:a20538c761df','space-sample-2','bold','a20538c761df'),
('space-sample-2:broken:a20538c761df','space-sample-2','broken','a20538c761df'),
('space-sample-2:bulk:a20538c761df','space-sample-2','bulk','a20538c761df'),
('space-sample-2:twotone:a20538c761df','space-sample-2','twotone','a20538c761df'),
('space-sample-3:linear:f5a733744072','space-sample-3','linear','f5a733744072'),
('space-sample-3:outline:f5a733744072','space-sample-3','outline','f5a733744072'),
('space-sample-3:bold:f5a733744072','space-sample-3','bold','f5a733744072'),
('space-sample-3:broken:f5a733744072','space-sample-3','broken','f5a733744072'),
('space-sample-3:bulk:f5a733744072','space-sample-3','bulk','f5a733744072'),
('space-sample-3:twotone:f5a733744072','space-sample-3','twotone','f5a733744072'),
('space2-sample-1:linear:1f0b72d1b5eb','space2-sample-1','linear','1f0b72d1b5eb'),
('space2-sample-1:outline:1f0b72d1b5eb','space2-sample-1','outline','1f0b72d1b5eb'),
('space2-sample-1:bold:1f0b72d1b5eb','space2-sample-1','bold','1f0b72d1b5eb'),
('space2-sample-1:broken:1f0b72d1b5eb','space2-sample-1','broken','1f0b72d1b5eb'),
('space2-sample-1:bulk:1f0b72d1b5eb','space2-sample-1','bulk','1f0b72d1b5eb'),
('space2-sample-1:twotone:1f0b72d1b5eb','space2-sample-1','twotone','1f0b72d1b5eb'),
('space2-sample-2:linear:efe984beefeb','space2-sample-2','linear','efe984beefeb'),
('space2-sample-2:outline:efe984beefeb','space2-sample-2','outline','efe984beefeb'),
('space2-sample-2:bold:efe984beefeb','space2-sample-2','bold','efe984beefeb'),
('space2-sample-2:broken:efe984beefeb','space2-sample-2','broken','efe984beefeb'),
('space2-sample-2:bulk:efe984beefeb','space2-sample-2','bulk','efe984beefeb'),
('space2-sample-2:twotone:efe984beefeb','space2-sample-2','twotone','efe984beefeb'),
('space2-sample-3:linear:6f150718992a','space2-sample-3','linear','6f150718992a'),
('space2-sample-3:outline:6f150718992a','space2-sample-3','outline','6f150718992a'),
('space2-sample-3:bold:6f150718992a','space2-sample-3','bold','6f150718992a'),
('space2-sample-3:broken:6f150718992a','space2-sample-3','broken','6f150718992a'),
('space2-sample-3:bulk:6f150718992a','space2-sample-3','bulk','6f150718992a'),
('space2-sample-3:twotone:6f150718992a','space2-sample-3','twotone','6f150718992a'),
('sports-sample-1:linear:b5ed2389a064','sports-sample-1','linear','b5ed2389a064'),
('sports-sample-1:outline:b5ed2389a064','sports-sample-1','outline','b5ed2389a064'),
('sports-sample-1:bold:b5ed2389a064','sports-sample-1','bold','b5ed2389a064'),
('sports-sample-1:broken:b5ed2389a064','sports-sample-1','broken','b5ed2389a064'),
('sports-sample-1:bulk:b5ed2389a064','sports-sample-1','bulk','b5ed2389a064'),
('sports-sample-1:twotone:b5ed2389a064','sports-sample-1','twotone','b5ed2389a064'),
('sports-sample-2:linear:eccfc61e51d7','sports-sample-2','linear','eccfc61e51d7'),
('sports-sample-2:outline:eccfc61e51d7','sports-sample-2','outline','eccfc61e51d7'),
('sports-sample-2:bold:eccfc61e51d7','sports-sample-2','bold','eccfc61e51d7'),
('sports-sample-2:broken:eccfc61e51d7','sports-sample-2','broken','eccfc61e51d7'),
('sports-sample-2:bulk:eccfc61e51d7','sports-sample-2','bulk','eccfc61e51d7'),
('sports-sample-2:twotone:eccfc61e51d7','sports-sample-2','twotone','eccfc61e51d7'),
('sports-sample-3:linear:30a813cb6f37','sports-sample-3','linear','30a813cb6f37'),
('sports-sample-3:outline:30a813cb6f37','sports-sample-3','outline','30a813cb6f37'),
('sports-sample-3:bold:30a813cb6f37','sports-sample-3','bold','30a813cb6f37'),
('sports-sample-3:broken:30a813cb6f37','sports-sample-3','broken','30a813cb6f37'),
('sports-sample-3:bulk:30a813cb6f37','sports-sample-3','bulk','30a813cb6f37'),
('sports-sample-3:twotone:30a813cb6f37','sports-sample-3','twotone','30a813cb6f37'),
('sports2-sample-1:linear:209cc56ae206','sports2-sample-1','linear','209cc56ae206'),
('sports2-sample-1:outline:209cc56ae206','sports2-sample-1','outline','209cc56ae206'),
('sports2-sample-1:bold:209cc56ae206','sports2-sample-1','bold','209cc56ae206'),
('sports2-sample-1:broken:209cc56ae206','sports2-sample-1','broken','209cc56ae206'),
('sports2-sample-1:bulk:209cc56ae206','sports2-sample-1','bulk','209cc56ae206'),
('sports2-sample-1:twotone:209cc56ae206','sports2-sample-1','twotone','209cc56ae206'),
('sports2-sample-2:linear:d3146cfb566d','sports2-sample-2','linear','d3146cfb566d'),
('sports2-sample-2:outline:d3146cfb566d','sports2-sample-2','outline','d3146cfb566d'),
('sports2-sample-2:bold:d3146cfb566d','sports2-sample-2','bold','d3146cfb566d'),
('sports2-sample-2:broken:d3146cfb566d','sports2-sample-2','broken','d3146cfb566d'),
('sports2-sample-2:bulk:d3146cfb566d','sports2-sample-2','bulk','d3146cfb566d'),
('sports2-sample-2:twotone:d3146cfb566d','sports2-sample-2','twotone','d3146cfb566d'),
('sports2-sample-3:linear:23da873545a4','sports2-sample-3','linear','23da873545a4'),
('sports2-sample-3:outline:23da873545a4','sports2-sample-3','outline','23da873545a4'),
('sports2-sample-3:bold:23da873545a4','sports2-sample-3','bold','23da873545a4'),
('sports2-sample-3:broken:23da873545a4','sports2-sample-3','broken','23da873545a4'),
('sports2-sample-3:bulk:23da873545a4','sports2-sample-3','bulk','23da873545a4'),
('sports2-sample-3:twotone:23da873545a4','sports2-sample-3','twotone','23da873545a4'),
('telephone-sample-1:linear:56ef08a5526e','telephone-sample-1','linear','56ef08a5526e'),
('telephone-sample-1:outline:56ef08a5526e','telephone-sample-1','outline','56ef08a5526e'),
('telephone-sample-1:bold:56ef08a5526e','telephone-sample-1','bold','56ef08a5526e'),
('telephone-sample-1:broken:56ef08a5526e','telephone-sample-1','broken','56ef08a5526e'),
('telephone-sample-1:bulk:56ef08a5526e','telephone-sample-1','bulk','56ef08a5526e'),
('telephone-sample-1:twotone:56ef08a5526e','telephone-sample-1','twotone','56ef08a5526e'),
('telephone-sample-2:linear:61739cfd4b98','telephone-sample-2','linear','61739cfd4b98'),
('telephone-sample-2:outline:61739cfd4b98','telephone-sample-2','outline','61739cfd4b98'),
('telephone-sample-2:bold:61739cfd4b98','telephone-sample-2','bold','61739cfd4b98'),
('telephone-sample-2:broken:61739cfd4b98','telephone-sample-2','broken','61739cfd4b98'),
('telephone-sample-2:bulk:61739cfd4b98','telephone-sample-2','bulk','61739cfd4b98'),
('telephone-sample-2:twotone:61739cfd4b98','telephone-sample-2','twotone','61739cfd4b98'),
('telephone-sample-3:linear:a10c8f18b6b8','telephone-sample-3','linear','a10c8f18b6b8'),
('telephone-sample-3:outline:a10c8f18b6b8','telephone-sample-3','outline','a10c8f18b6b8'),
('telephone-sample-3:bold:a10c8f18b6b8','telephone-sample-3','bold','a10c8f18b6b8'),
('telephone-sample-3:broken:a10c8f18b6b8','telephone-sample-3','broken','a10c8f18b6b8'),
('telephone-sample-3:bulk:a10c8f18b6b8','telephone-sample-3','bulk','a10c8f18b6b8'),
('telephone-sample-3:twotone:a10c8f18b6b8','telephone-sample-3','twotone','a10c8f18b6b8'),
('search-sample-1:linear:1d6e8e2995ab','search-sample-1','linear','1d6e8e2995ab'),
('search-sample-1:outline:1d6e8e2995ab','search-sample-1','outline','1d6e8e2995ab'),
('search-sample-1:bold:1d6e8e2995ab','search-sample-1','bold','1d6e8e2995ab'),
('search-sample-1:broken:1d6e8e2995ab','search-sample-1','broken','1d6e8e2995ab'),
('search-sample-1:bulk:1d6e8e2995ab','search-sample-1','bulk','1d6e8e2995ab'),
('search-sample-1:twotone:1d6e8e2995ab','search-sample-1','twotone','1d6e8e2995ab'),
('search-sample-2:linear:ce6ab45e6616','search-sample-2','linear','ce6ab45e6616'),
('search-sample-2:outline:ce6ab45e6616','search-sample-2','outline','ce6ab45e6616'),
('search-sample-2:bold:ce6ab45e6616','search-sample-2','bold','ce6ab45e6616'),
('search-sample-2:broken:ce6ab45e6616','search-sample-2','broken','ce6ab45e6616'),
('search-sample-2:bulk:ce6ab45e6616','search-sample-2','bulk','ce6ab45e6616'),
('search-sample-2:twotone:ce6ab45e6616','search-sample-2','twotone','ce6ab45e6616'),
('search-sample-3:linear:20a2b0f131f4','search-sample-3','linear','20a2b0f131f4'),
('search-sample-3:outline:20a2b0f131f4','search-sample-3','outline','20a2b0f131f4'),
('search-sample-3:bold:20a2b0f131f4','search-sample-3','bold','20a2b0f131f4'),
('search-sample-3:broken:20a2b0f131f4','search-sample-3','broken','20a2b0f131f4'),
('search-sample-3:bulk:20a2b0f131f4','search-sample-3','bulk','20a2b0f131f4'),
('search-sample-3:twotone:20a2b0f131f4','search-sample-3','twotone','20a2b0f131f4'),
('wedding-sample-1:linear:7ad7f809ff85','wedding-sample-1','linear','7ad7f809ff85'),
('wedding-sample-1:outline:7ad7f809ff85','wedding-sample-1','outline','7ad7f809ff85'),
('wedding-sample-1:bold:7ad7f809ff85','wedding-sample-1','bold','7ad7f809ff85'),
('wedding-sample-1:broken:7ad7f809ff85','wedding-sample-1','broken','7ad7f809ff85'),
('wedding-sample-1:bulk:7ad7f809ff85','wedding-sample-1','bulk','7ad7f809ff85'),
('wedding-sample-1:twotone:7ad7f809ff85','wedding-sample-1','twotone','7ad7f809ff85'),
('wedding-sample-2:linear:60ff85977646','wedding-sample-2','linear','60ff85977646'),
('wedding-sample-2:outline:60ff85977646','wedding-sample-2','outline','60ff85977646'),
('wedding-sample-2:bold:60ff85977646','wedding-sample-2','bold','60ff85977646'),
('wedding-sample-2:broken:60ff85977646','wedding-sample-2','broken','60ff85977646'),
('wedding-sample-2:bulk:60ff85977646','wedding-sample-2','bulk','60ff85977646'),
('wedding-sample-2:twotone:60ff85977646','wedding-sample-2','twotone','60ff85977646'),
('wedding-sample-3:linear:ff54aae6258d','wedding-sample-3','linear','ff54aae6258d'),
('wedding-sample-3:outline:ff54aae6258d','wedding-sample-3','outline','ff54aae6258d'),
('wedding-sample-3:bold:ff54aae6258d','wedding-sample-3','bold','ff54aae6258d'),
('wedding-sample-3:broken:ff54aae6258d','wedding-sample-3','broken','ff54aae6258d'),
('wedding-sample-3:bulk:ff54aae6258d','wedding-sample-3','bulk','ff54aae6258d'),
('wedding-sample-3:twotone:ff54aae6258d','wedding-sample-3','twotone','ff54aae6258d'),
('vr-sample-1:linear:e546026f91af','vr-sample-1','linear','e546026f91af'),
('vr-sample-1:outline:e546026f91af','vr-sample-1','outline','e546026f91af'),
('vr-sample-1:bold:e546026f91af','vr-sample-1','bold','e546026f91af'),
('vr-sample-1:broken:e546026f91af','vr-sample-1','broken','e546026f91af'),
('vr-sample-1:bulk:e546026f91af','vr-sample-1','bulk','e546026f91af'),
('vr-sample-1:twotone:e546026f91af','vr-sample-1','twotone','e546026f91af'),
('vr-sample-2:linear:b21147a955bd','vr-sample-2','linear','b21147a955bd'),
('vr-sample-2:outline:b21147a955bd','vr-sample-2','outline','b21147a955bd'),
('vr-sample-2:bold:b21147a955bd','vr-sample-2','bold','b21147a955bd'),
('vr-sample-2:broken:b21147a955bd','vr-sample-2','broken','b21147a955bd'),
('vr-sample-2:bulk:b21147a955bd','vr-sample-2','bulk','b21147a955bd'),
('vr-sample-2:twotone:b21147a955bd','vr-sample-2','twotone','b21147a955bd'),
('vr-sample-3:linear:777f9c5514f8','vr-sample-3','linear','777f9c5514f8'),
('vr-sample-3:outline:777f9c5514f8','vr-sample-3','outline','777f9c5514f8'),
('vr-sample-3:bold:777f9c5514f8','vr-sample-3','bold','777f9c5514f8'),
('vr-sample-3:broken:777f9c5514f8','vr-sample-3','broken','777f9c5514f8'),
('vr-sample-3:bulk:777f9c5514f8','vr-sample-3','bulk','777f9c5514f8'),
('vr-sample-3:twotone:777f9c5514f8','vr-sample-3','twotone','777f9c5514f8')
on conflict(id) do nothing;
commit;

commit;

-- ============================================================================
-- 0031_local_worker_atomic_reservations.sql
-- ============================================================================

begin;

-- Opt-in development RPCs atomically bind locally executed work before remote
-- polling workers can observe it. Existing deployment RPCs remain unchanged.
create or replace function public.create_local_generation_job_v2(
  p_user_id uuid, p_spec jsonb, p_skill_version text, p_idempotency_key uuid,
  p_worker_id text, p_lease_seconds integer default 900
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_job_id uuid;
begin
  if coalesce(trim(p_worker_id), '') = '' or p_worker_id !~ '^local-web-[0-9]+$' then
    raise exception using message = 'INVALID_LOCAL_WORKER_ID';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using message = 'INVALID_WORKER_LEASE_SECONDS';
  end if;
  v_job_id := public.create_generation_job_v2(p_user_id, p_spec, p_skill_version, p_idempotency_key);
  update public.generation_jobs
  set worker_lease_owner = p_worker_id,
      worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_job_id and status in ('queued', 'processing');
  return v_job_id;
end;
$$;
revoke all on function public.create_local_generation_job_v2(uuid, jsonb, text, uuid, text, integer) from public, anon;
grant execute on function public.create_local_generation_job_v2(uuid, jsonb, text, uuid, text, integer) to authenticated, service_role;

create or replace function public.retry_local_generation_variant_v2(
  p_user_id uuid, p_variant_id uuid, p_worker_id text,
  p_lease_seconds integer default 900
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_job_id uuid;
begin
  if coalesce(trim(p_worker_id), '') = '' or p_worker_id !~ '^local-web-[0-9]+$' then
    raise exception using message = 'INVALID_LOCAL_WORKER_ID';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using message = 'INVALID_WORKER_LEASE_SECONDS';
  end if;
  v_job_id := public.retry_generation_variant_v2(p_user_id, p_variant_id);
  update public.generation_jobs
  set worker_lease_owner = p_worker_id,
      worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_job_id;
  return v_job_id;
end;
$$;
revoke all on function public.retry_local_generation_variant_v2(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.retry_local_generation_variant_v2(uuid, uuid, text, integer) to service_role;

create or replace function public.create_local_variant_detail_edit_v2(
  p_user_id uuid, p_variant_id uuid, p_instruction text, p_idempotency_key uuid,
  p_worker_id text, p_lease_seconds integer default 900
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_revision_id uuid;
begin
  if coalesce(trim(p_worker_id), '') = '' or p_worker_id !~ '^local-web-[0-9]+$' then
    raise exception using message = 'INVALID_LOCAL_WORKER_ID';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using message = 'INVALID_WORKER_LEASE_SECONDS';
  end if;

  v_result := public.create_variant_detail_edit_v2(
    p_user_id, p_variant_id, p_instruction, p_idempotency_key
  );
  v_revision_id := (v_result ->> 'id')::uuid;

  update public.generation_variant_revisions
  set worker_lease_owner = p_worker_id,
      worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_revision_id and status in ('queued', 'processing');

  return v_result;
end;
$$;
revoke all on function public.create_local_variant_detail_edit_v2(uuid, uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.create_local_variant_detail_edit_v2(uuid, uuid, text, uuid, text, integer) to service_role;

commit;

-- ============================================================================
-- 0032_expand_generation_subject_description.sql
-- ============================================================================

begin;

-- Keep the database contract aligned with MAX_SUBJECT_DESCRIPTION_LENGTH.
alter table public.generation_subjects
  drop constraint if exists generation_subjects_description_check;

alter table public.generation_subjects
  add constraint generation_subjects_description_check
  check (char_length(description) between 1 and 400);

commit;

-- ============================================================================
-- 0033_icon_projects.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0034_icon_project_limit.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0035_expand_icon_project_rules.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0036_icon_project_descriptions.sql
-- ============================================================================

begin;

alter table public.icon_projects
  add column if not exists description text not null default '';

alter table public.icon_projects
  drop constraint if exists icon_projects_description_check;
alter table public.icon_projects
  add constraint icon_projects_description_check
  check (
    description = ''
    or (
      description ~ '[一-龥]'
      and char_length(description) <= 300
    )
    or (
      description !~ '[一-龥]'
      and cardinality(regexp_split_to_array(trim(description), '\s+')) <= 400
    )
  );

comment on column public.icon_projects.description is
  'Project and feature-module summary. Chinese/mixed text: 300 characters; English: 400 words.';

commit;

-- ============================================================================
-- 0037_icon_project_themes.sql
-- ============================================================================

begin;

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

commit;

-- ============================================================================
-- 0038_icon_project_saved_themes.sql
-- ============================================================================

begin;

alter table public.icon_projects
  add column if not exists ai_theme jsonb,
  add column if not exists custom_theme jsonb;

update public.icon_projects
set ai_theme = theme
where theme_source = 'ai' and theme is not null and ai_theme is null;

update public.icon_projects
set custom_theme = theme
where theme_source = 'manual' and theme is not null and custom_theme is null;

commit;

-- ============================================================================
-- 0039_project_svg_icon_sets.sql
-- ============================================================================

begin;

-- Editable SVG sets generated on the icon canvas, separate from raster generation jobs.
create table public.project_svg_icon_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.icon_projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan jsonb not null,
  snapshot jsonb not null,
  recycled_at timestamptz,
  created_at timestamptz not null default now()
);
create index project_svg_icon_sets_project_created_idx
  on public.project_svg_icon_sets(project_id, created_at desc);

create table public.project_svg_icons (
  set_id uuid not null references public.project_svg_icon_sets(id) on delete cascade,
  subject_id text not null,
  svg text not null check (octet_length(svg) <= 100000),
  is_favorite boolean not null default false,
  recycled_at timestamptz,
  constraint project_svg_icons_favorite_recycle_exclusive check (not (is_favorite and recycled_at is not null)),
  created_at timestamptz not null default now(),
  primary key (set_id, subject_id)
);

alter table public.project_svg_icon_sets enable row level security;
create policy "users read own svg icon sets" on public.project_svg_icon_sets
  for select using (user_id = auth.uid());
create policy "users create own svg icon sets" on public.project_svg_icon_sets
  for insert with check (user_id = auth.uid() and exists (
    select 1 from public.icon_projects where id = project_id and user_id = auth.uid()
  ));
alter table public.project_svg_icons enable row level security;
create policy "users read own svg icons" on public.project_svg_icons
  for select using (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));
create policy "users create own svg icons" on public.project_svg_icons
  for insert with check (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));
create policy "users update own svg icons" on public.project_svg_icons
  for update using (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  )) with check (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));
create policy "users delete own svg icons" on public.project_svg_icons
  for delete using (exists (
    select 1 from public.project_svg_icon_sets where id = set_id and user_id = auth.uid()
  ));

commit;

-- ============================================================================
-- 0040_project_svg_icon_set_positions.sql
-- ============================================================================

begin;

-- Persist each generated icon set's position in the project canvas.
alter table public.project_svg_icon_sets
  add column canvas_position jsonb not null default '{"x":0,"y":0}'::jsonb,
  add column is_favorite boolean not null default false;

alter table public.project_svg_icon_sets
  add constraint project_svg_icon_sets_canvas_position_shape check (
    jsonb_typeof(canvas_position) = 'object'
    and jsonb_typeof(canvas_position -> 'x') = 'number'
    and jsonb_typeof(canvas_position -> 'y') = 'number'
    and abs((canvas_position ->> 'x')::numeric) <= 100000
    and abs((canvas_position ->> 'y')::numeric) <= 100000
  );

alter table public.project_svg_icon_sets
  add constraint project_svg_icon_sets_favorite_recycle_exclusive
  check (not (is_favorite and recycled_at is not null));

create policy "users update own svg icon sets" on public.project_svg_icon_sets
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.icon_projects where id = project_id and user_id = auth.uid()
  ));

create policy "users delete own svg icon sets" on public.project_svg_icon_sets
  for delete using (user_id = auth.uid());

commit;
