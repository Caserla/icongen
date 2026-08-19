alter table public.generation_jobs
  add column skill_name text,
  add column image_provider text,
  add column image_model text;

alter table public.generation_results
  add column skill_name text,
  add column skill_version text,
  add column image_provider text,
  add column image_model text;

drop function public.claim_generation_job(uuid);

create or replace function public.claim_generation_job(
  p_job_id uuid,
  p_skill_name text,
  p_skill_version text,
  p_image_provider text,
  p_image_model text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.generation_jobs
  set status = 'processing', started_at = coalesce(started_at, now()),
      attempt_count = attempt_count + 1, skill_name = p_skill_name,
      skill_version = p_skill_version, image_provider = p_image_provider,
      image_model = p_image_model, updated_at = now()
  where id = p_job_id and status in ('queued', 'processing');
  if not found then raise exception 'job is not claimable'; end if;
end;
$$;

revoke all on function public.claim_generation_job(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_generation_job(uuid, text, text, text, text)
  to service_role;

