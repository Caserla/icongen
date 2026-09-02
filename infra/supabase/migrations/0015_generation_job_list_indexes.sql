-- Keep private icon-list pagination fast as an account accumulates jobs.
create index if not exists generation_jobs_user_status_created_idx
  on public.generation_jobs(user_id, status, created_at desc);

create index if not exists generation_jobs_user_purpose_created_idx
  on public.generation_jobs(user_id, (generation_spec->>'purpose'), created_at desc);

create index if not exists generation_jobs_user_style_created_idx
  on public.generation_jobs(user_id, ((generation_spec->'style')->>'preset'), created_at desc);

create index if not exists generation_jobs_user_structure_created_idx
  on public.generation_jobs(user_id, ((generation_spec->'style')->>'graphicStructure'), created_at desc);
