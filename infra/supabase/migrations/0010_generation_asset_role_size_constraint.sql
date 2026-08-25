alter table public.generation_assets
  drop constraint if exists generation_assets_size_check;

alter table public.generation_assets
  add constraint generation_assets_size_check check (
    (asset_role in ('source', 'preview') and size > 0)
    or
    (
      asset_role = 'output'
      and size in (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024)
    )
  );
