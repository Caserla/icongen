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
