create table if not exists public.generation_variant_revisions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.generation_variants(id) on delete cascade,
  parent_revision_id uuid references public.generation_variant_revisions(id) on delete set null,
  revision_number integer not null check (revision_number > 0),
  instruction text not null check (char_length(trim(instruction)) between 5 and 500),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  source_bucket text,
  source_path text,
  preview_bucket text,
  preview_path text,
  assets jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  provider_request_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (variant_id, revision_number)
);

alter table public.generation_variants
  add column if not exists active_revision_id uuid
  references public.generation_variant_revisions(id) on delete set null;

create unique index if not exists generation_variant_revisions_one_active_edit
  on public.generation_variant_revisions(variant_id)
  where status in ('queued', 'processing');

create index if not exists generation_variant_revisions_variant_created_idx
  on public.generation_variant_revisions(variant_id, created_at desc);

alter table public.generation_variant_revisions enable row level security;

drop policy if exists generation_variant_revisions_select_own on public.generation_variant_revisions;
create policy generation_variant_revisions_select_own
  on public.generation_variant_revisions for select
  using (
    exists (
      select 1
      from public.generation_variants v
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      where v.id = generation_variant_revisions.variant_id
        and j.user_id = auth.uid()
    )
  );
