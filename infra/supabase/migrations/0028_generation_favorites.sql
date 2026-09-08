create table if not exists public.generation_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  variant_id uuid not null references public.generation_variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create index if not exists generation_favorites_user_created_idx
  on public.generation_favorites(user_id, created_at desc);

alter table public.generation_favorites enable row level security;

drop policy if exists generation_favorites_select_own on public.generation_favorites;
drop policy if exists generation_favorites_insert_own on public.generation_favorites;
drop policy if exists generation_favorites_delete_own on public.generation_favorites;

create policy generation_favorites_select_own
  on public.generation_favorites for select
  using (auth.uid() = user_id);

create policy generation_favorites_insert_own
  on public.generation_favorites for insert
  with check (
    auth.uid() = user_id and exists (
      select 1
      from public.generation_variants v
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      where v.id = variant_id and v.status = 'completed' and j.user_id = auth.uid()
    )
  );

create policy generation_favorites_delete_own
  on public.generation_favorites for delete
  using (auth.uid() = user_id);
