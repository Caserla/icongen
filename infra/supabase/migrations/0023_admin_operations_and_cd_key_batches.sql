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
