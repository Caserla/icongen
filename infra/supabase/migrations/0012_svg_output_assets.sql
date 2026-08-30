alter table public.generation_assets
  add column if not exists format text not null default 'png'
  check (format in ('png', 'svg'));

alter table public.generation_assets
  add column if not exists mime_type text not null default 'image/png';

alter table public.generation_assets
  drop constraint if exists generation_assets_variant_role_size_key;

alter table public.generation_assets
  add constraint generation_assets_variant_role_size_format_key
  unique (variant_id, asset_role, size, format);

alter table public.generation_assets
  drop constraint if exists generation_assets_size_check;

alter table public.generation_assets
  add constraint generation_assets_size_check check (
    (format = 'svg' and asset_role = 'output' and size > 0)
    or
    (format = 'png' and asset_role in ('source', 'preview') and size > 0)
    or
    (format = 'png' and asset_role = 'output' and size in (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024))
  );

create index if not exists generation_assets_variant_format_idx
  on public.generation_assets(variant_id, format, asset_role);
