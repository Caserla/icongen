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
