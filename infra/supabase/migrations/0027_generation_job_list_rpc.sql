-- Collapse the icon-library job/subject/variant/asset reads into one database
-- round trip. The function is security-invoker and always scopes to auth.uid().
create or replace function public.list_generation_jobs_v1(
  p_page integer default 1,
  p_page_size integer default 12,
  p_usage text default 'interaction',
  p_style text default null,
  p_structure text default null,
  p_status text default null
) returns table (
  id uuid,
  status text,
  created_at timestamptz,
  generation_spec jsonb,
  total_count bigint,
  subjects jsonb,
  preview_assets jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select j.*
    from public.generation_jobs j
    where j.user_id = auth.uid()
      and j.id not in (
        '11111111-1111-4111-8111-111111111111'::uuid,
        '22222222-2222-4222-8222-222222222222'::uuid
      )
      and (p_usage <> 'interaction' or j.generation_spec->>'purpose' = 'interaction')
      and (p_usage <> 'illustration' or j.generation_spec->>'purpose' = 'app-icon')
      and (p_style is null or j.generation_spec->'style'->>'preset' = p_style)
      and (p_structure is null or j.generation_spec->'style'->>'graphicStructure' = p_structure)
      and (
        p_status is null
        or (p_status = 'in-progress' and j.status in ('queued', 'processing'))
        or (p_status <> 'in-progress' and j.status::text = p_status)
      )
  ), paged as (
    select f.*
    from filtered f
    order by f.created_at desc
    limit greatest(1, least(48, p_page_size))
    offset (greatest(1, p_page) - 1) * greatest(1, least(48, p_page_size))
  )
  select
    p.id,
    p.status::text,
    p.created_at,
    p.generation_spec,
    (select count(*) from filtered),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'position', s.position) order by s.position)
      from public.generation_subjects s where s.job_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', picked.id,
        'variant_id', picked.variant_id,
        'asset_role', picked.asset_role,
        'size', picked.size,
        'storage_bucket', picked.storage_bucket,
        'storage_path', picked.storage_path
      ) order by picked.subject_position, picked.slot)
      from (
        select preferred.* from (
          select distinct on (v.id)
            a.id, a.variant_id, a.asset_role, a.size, a.storage_bucket, a.storage_path,
            s.position as subject_position, v.slot
          from public.generation_subjects s
          join public.generation_variants v on v.subject_id = s.id and v.status = 'completed'
          join public.generation_assets a on a.variant_id = v.id and a.format = 'png'
          where s.job_id = p.id
          order by v.id,
            case a.asset_role when 'preview' then 0 when 'source' then 1 when 'output' then 2 else 9 end,
            case when a.size <= 256 then 0 else 1 end,
            case when a.size <= 256 then -a.size else a.size end
        ) preferred
        order by preferred.subject_position, preferred.slot
        limit 3
      ) picked
    ), '[]'::jsonb)
  from paged p
  order by p.created_at desc;
$$;

revoke all on function public.list_generation_jobs_v1(integer, integer, text, text, text, text) from public;
grant execute on function public.list_generation_jobs_v1(integer, integer, text, text, text, text) to authenticated, service_role;
