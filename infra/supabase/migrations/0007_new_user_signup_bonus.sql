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
