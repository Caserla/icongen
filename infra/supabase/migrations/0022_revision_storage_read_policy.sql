drop policy if exists "users read own generated revision objects" on storage.objects;

create policy "users read own generated revision objects"
  on storage.objects for select
  using (
    bucket_id = 'generated-icons'
    and exists (
      select 1
      from public.generation_variant_revisions r
      join public.generation_variants v on v.id = r.variant_id
      join public.generation_subjects s on s.id = v.subject_id
      join public.generation_jobs j on j.id = s.job_id
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(r.assets) = 'array' then r.assets else '[]'::jsonb end
      ) asset
      where j.user_id = auth.uid()
        and asset ->> 'storageBucket' = bucket_id
        and asset ->> 'storagePath' = name
    )
  );
