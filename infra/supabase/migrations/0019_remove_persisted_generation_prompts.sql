-- Compiled prompts are server-side implementation details. RLS isolates rows,
-- not sensitive columns, so prompts must not live in user-readable tables.
alter table public.generation_variants drop column if exists prompt;

-- Remove the equivalent field from the retired v1 result table as well.
alter table public.generation_results drop column if exists prompt;
