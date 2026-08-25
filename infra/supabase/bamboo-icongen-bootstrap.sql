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
  add column subject_count smallint check (subject_count >= 1),
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
  position smallint not null check (position >= 0),
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
  asset_role text not null default 'output' check (asset_role in ('source', 'preview', 'output')),
  size smallint not null check (
    (asset_role in ('source', 'preview') and size > 0)
    or
    (
      asset_role = 'output'
      and size in (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024)
    )
  ),
  width smallint not null check (width > 0),
  height smallint not null check (height > 0),
  has_alpha boolean not null,
  storage_bucket text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (variant_id, asset_role, size),
  unique (storage_bucket, storage_path)
);

create index generation_subjects_job_position_idx on public.generation_subjects(job_id, position);
create index generation_variants_subject_slot_idx on public.generation_variants(subject_id, slot);
create index generation_assets_variant_role_size_idx on public.generation_assets(variant_id, asset_role, size);

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
  if v_credit_cost < 1 then raise exception 'at least one subject is required'; end if;

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
    if v_completed = 3 then
      v_any_completed := true;
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
