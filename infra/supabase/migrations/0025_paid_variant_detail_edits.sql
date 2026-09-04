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
