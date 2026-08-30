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
