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
