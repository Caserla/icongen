begin;

-- A job with at least one completed variant is partial rather than wholly failed.
-- This guard also corrects the result of older failure-finalization functions.
create or replace function public.guard_generation_job_partial_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'failed' and exists (
    select 1
    from public.generation_subjects s
    join public.generation_variants v on v.subject_id = s.id
    where s.job_id = new.id and v.status = 'completed'
  ) then
    new.status = 'partial';
  end if;
  return new;
end;
$$;

drop trigger if exists generation_jobs_guard_partial_status on public.generation_jobs;
create trigger generation_jobs_guard_partial_status
  before insert or update of status on public.generation_jobs
  for each row execute function public.guard_generation_job_partial_status();

commit;
