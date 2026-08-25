alter table public.generation_assets
  add column if not exists asset_role text not null default 'output'
  check (asset_role in ('source', 'preview', 'output'));

alter table public.generation_assets
  drop constraint if exists generation_assets_variant_id_size_key;

alter table public.generation_assets
  add constraint generation_assets_variant_role_size_key unique (variant_id, asset_role, size);

drop index if exists public.generation_assets_variant_size_idx;
create index generation_assets_variant_role_size_idx
  on public.generation_assets(variant_id, asset_role, size);
