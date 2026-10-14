-- Local self-use: stop signup credit grants, retain historical rows for safety.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Disable financial RPC entrypoints, without deleting historical order/ledger data.
do $$
declare item record;
begin
  for item in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'credit_paid_order','create_credit_redemption_code','redeem_credit_code',
      'create_credit_redemption_batch','disable_credit_redemption_batch',
      'create_generation_job_v2','create_local_generation_job_v2',
      'create_variant_detail_edit_v2','create_local_variant_detail_edit_v2',
      'refund_failed_variant_detail_edit_v2','credit_failed_generation_job',
      'finalize_generation_job_v2_failure'
    )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', item.signature);
  end loop;
end;
$$;
