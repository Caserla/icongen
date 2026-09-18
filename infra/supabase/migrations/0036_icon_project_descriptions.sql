alter table public.icon_projects
  add column if not exists description text not null default '';

alter table public.icon_projects
  drop constraint if exists icon_projects_description_check;
alter table public.icon_projects
  add constraint icon_projects_description_check
  check (
    description = ''
    or (
      description ~ '[一-龥]'
      and char_length(description) <= 300
    )
    or (
      description !~ '[一-龥]'
      and cardinality(regexp_split_to_array(trim(description), '\s+')) <= 400
    )
  );

comment on column public.icon_projects.description is
  'Project and feature-module summary. Chinese/mixed text: 300 characters; English: 400 words.';
