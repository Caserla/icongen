alter table public.generation_jobs
  add column if not exists worker_lease_owner text,
  add column if not exists worker_lease_expires_at timestamptz;

alter table public.generation_variant_revisions
  add column if not exists worker_lease_owner text,
  add column if not exists worker_lease_expires_at timestamptz;

create index if not exists generation_jobs_worker_claim_idx
  on public.generation_jobs(status, worker_lease_expires_at, created_at)
  where status in ('queued', 'processing');

create index if not exists generation_variant_revisions_worker_claim_idx
  on public.generation_variant_revisions(status, worker_lease_expires_at, created_at)
  where status in ('queued', 'processing');

create or replace function public.claim_next_worker_task(
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns table(task_type text, task_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker id is required';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'lease seconds must be between 30 and 900';
  end if;

  select r.id into v_id
  from public.generation_variant_revisions r
  where r.status in ('queued', 'processing')
    and (
      r.worker_lease_expires_at is null and r.status = 'queued'
      or r.worker_lease_expires_at <= now()
      or (
        r.worker_lease_expires_at is null
        and r.status = 'processing'
        and r.updated_at < now() - interval '5 minutes'
      )
    )
  order by r.created_at
  for update skip locked
  limit 1;

  if v_id is not null then
    update public.generation_variant_revisions
    set worker_lease_owner = p_worker_id,
        worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    where id = v_id;
    return query select 'edit'::text, v_id;
    return;
  end if;

  select j.id into v_id
  from public.generation_jobs j
  where j.status in ('queued', 'processing')
    and (
      j.worker_lease_expires_at is null and j.status = 'queued'
      or j.worker_lease_expires_at <= now()
      or (
        j.worker_lease_expires_at is null
        and j.status = 'processing'
        and j.updated_at < now() - interval '5 minutes'
      )
    )
  order by j.created_at
  for update skip locked
  limit 1;

  if v_id is not null then
    update public.generation_jobs
    set worker_lease_owner = p_worker_id,
        worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    where id = v_id;
    return query select 'job'::text, v_id;
  end if;
end;
$$;

revoke all on function public.claim_next_worker_task(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_next_worker_task(text, integer)
  to service_role;
