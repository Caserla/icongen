-- Opt-in development RPCs atomically bind locally executed work before remote
-- polling workers can observe it. Existing deployment RPCs remain unchanged.
create or replace function public.create_local_generation_job_v2(
  p_user_id uuid, p_spec jsonb, p_skill_version text, p_idempotency_key uuid,
  p_worker_id text, p_lease_seconds integer default 900
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_job_id uuid;
begin
  if coalesce(trim(p_worker_id), '') = '' or p_worker_id !~ '^local-web-[0-9]+$' then
    raise exception using message = 'INVALID_LOCAL_WORKER_ID';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using message = 'INVALID_WORKER_LEASE_SECONDS';
  end if;
  v_job_id := public.create_generation_job_v2(p_user_id, p_spec, p_skill_version, p_idempotency_key);
  update public.generation_jobs
  set worker_lease_owner = p_worker_id,
      worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_job_id and status in ('queued', 'processing');
  return v_job_id;
end;
$$;
revoke all on function public.create_local_generation_job_v2(uuid, jsonb, text, uuid, text, integer) from public, anon;
grant execute on function public.create_local_generation_job_v2(uuid, jsonb, text, uuid, text, integer) to authenticated, service_role;

create or replace function public.retry_local_generation_variant_v2(
  p_user_id uuid, p_variant_id uuid, p_worker_id text,
  p_lease_seconds integer default 900
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_job_id uuid;
begin
  if coalesce(trim(p_worker_id), '') = '' or p_worker_id !~ '^local-web-[0-9]+$' then
    raise exception using message = 'INVALID_LOCAL_WORKER_ID';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using message = 'INVALID_WORKER_LEASE_SECONDS';
  end if;
  v_job_id := public.retry_generation_variant_v2(p_user_id, p_variant_id);
  update public.generation_jobs
  set worker_lease_owner = p_worker_id,
      worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_job_id;
  return v_job_id;
end;
$$;
revoke all on function public.retry_local_generation_variant_v2(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.retry_local_generation_variant_v2(uuid, uuid, text, integer) to service_role;

create or replace function public.create_local_variant_detail_edit_v2(
  p_user_id uuid, p_variant_id uuid, p_instruction text, p_idempotency_key uuid,
  p_worker_id text, p_lease_seconds integer default 900
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_revision_id uuid;
begin
  if coalesce(trim(p_worker_id), '') = '' or p_worker_id !~ '^local-web-[0-9]+$' then
    raise exception using message = 'INVALID_LOCAL_WORKER_ID';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception using message = 'INVALID_WORKER_LEASE_SECONDS';
  end if;

  v_result := public.create_variant_detail_edit_v2(
    p_user_id, p_variant_id, p_instruction, p_idempotency_key
  );
  v_revision_id := (v_result ->> 'id')::uuid;

  update public.generation_variant_revisions
  set worker_lease_owner = p_worker_id,
      worker_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_revision_id and status in ('queued', 'processing');

  return v_result;
end;
$$;
revoke all on function public.create_local_variant_detail_edit_v2(uuid, uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.create_local_variant_detail_edit_v2(uuid, uuid, text, uuid, text, integer) to service_role;
