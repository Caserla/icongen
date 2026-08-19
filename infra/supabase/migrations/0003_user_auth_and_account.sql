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
  where user_id = v_user_id or idempotency_key = p_idempotency_key;
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

