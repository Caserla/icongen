-- A subject costs one credit and promises three variants. A partially delivered
-- subject keeps its original charge while failed variants remain free to retry.
-- Only a subject with zero usable variants receives an automatic refund.
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

  for v_subject in
    select id from public.generation_subjects where job_id = p_job_id order by position
  loop
    select count(*) into v_completed
    from public.generation_variants
    where subject_id = v_subject.id and status = 'completed';

    if v_completed > 0 then v_any_completed := true; end if;
    if v_completed = 3 then
      update public.generation_subjects
      set status = 'completed', error_code = null, error_message = null
      where id = v_subject.id;
    else
      update public.generation_variants
      set status = 'failed', error_code = p_error_code,
          error_message = left(p_error_message, 1000), updated_at = now()
      where subject_id = v_subject.id and status in ('queued', 'processing');

      update public.generation_subjects
      set status = case
            when v_completed > 0 then 'partial'::public.generation_status
            else 'failed'::public.generation_status
          end,
          error_code = p_error_code,
          error_message = left(p_error_message, 1000),
          -- A partial result retains the original charge. A fully failed
          -- subject is refunded once and may still use the free retry path.
          credit_refunded_at = case
            when v_completed = 0 then coalesce(credit_refunded_at, now())
            else credit_refunded_at
          end
      where id = v_subject.id;

      if v_completed = 0 then
        update public.credit_accounts
        set balance = balance + 1, updated_at = now()
        where user_id = v_job.user_id
          and not exists (
            select 1 from public.credit_ledger
            where user_id = v_job.user_id
              and idempotency_key = 'generation-subject-refund:' || v_subject.id::text
          )
        returning balance into v_balance;

        if found then
          insert into public.credit_ledger (
            user_id, entry_type, amount, balance_after, generation_job_id,
            idempotency_key
          ) values (
            v_job.user_id, 'generation_refund', 1, v_balance, p_job_id,
            'generation-subject-refund:' || v_subject.id::text
          );
          v_refunds := v_refunds + 1;
        end if;
      end if;
    end if;
  end loop;

  update public.generation_jobs
  set status = case
        when v_any_completed then 'partial'::public.generation_status
        else 'failed'::public.generation_status
      end,
      progress_percent = 100,
      progress_phase = 'completed',
      refunded_credit_count = refunded_credit_count + v_refunds,
      failure_refunded_at = case
        when v_refunds > 0 then now()
        else failure_refunded_at
      end,
      error_code = p_error_code,
      error_message = left(p_error_message, 1000),
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;
end;
$$;

-- Restarting a failed variant must be one atomic state transition. This avoids
-- a queued variant being paired with a terminal subject or job if one of the
-- former three independent updates fails halfway through.
create or replace function public.retry_generation_variant_v2(
  p_user_id uuid,
  p_variant_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_variant public.generation_variants%rowtype;
  v_subject public.generation_subjects%rowtype;
  v_job public.generation_jobs%rowtype;
begin
  if p_user_id <> auth.uid() and auth.role() <> 'service_role' then
    raise exception using message = 'NOT_AUTHORIZED';
  end if;

  select * into v_variant
  from public.generation_variants
  where id = p_variant_id
  for update;
  if not found then raise exception using message = 'GENERATION_VARIANT_NOT_FOUND'; end if;

  select * into v_subject
  from public.generation_subjects
  where id = v_variant.subject_id
  for update;

  select * into v_job
  from public.generation_jobs
  where id = v_subject.job_id
  for update;

  if v_job.user_id <> p_user_id then
    raise exception using message = 'GENERATION_VARIANT_NOT_FOUND';
  end if;
  if v_variant.status <> 'failed' then
    raise exception using message = 'VARIANT_NOT_FAILED';
  end if;

  update public.generation_variants
  set status = 'queued', started_at = null, completed_at = null,
      error_code = null, error_message = null, updated_at = now()
  where id = p_variant_id;

  update public.generation_subjects
  set status = 'processing', error_code = null, error_message = null,
      updated_at = now()
  where id = v_subject.id;

  update public.generation_jobs
  set status = 'queued', progress_phase = 'queued', completed_at = null,
      error_code = null, error_message = null, updated_at = now()
  where id = v_job.id;

  return v_job.id;
end;
$$;

revoke all on function public.retry_generation_variant_v2(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retry_generation_variant_v2(uuid, uuid)
  to service_role;
