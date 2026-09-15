-- Keep the database contract aligned with MAX_SUBJECT_DESCRIPTION_LENGTH.
alter table public.generation_subjects
  drop constraint if exists generation_subjects_description_check;

alter table public.generation_subjects
  add constraint generation_subjects_description_check
  check (char_length(description) between 1 and 400);
