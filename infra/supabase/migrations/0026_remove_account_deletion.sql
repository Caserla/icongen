-- Account deletion is no longer part of the product. Existing pending states
-- are safely returned to active before the obsolete workflow is removed.
update public.profiles set status = 'active' where status = 'deletion_pending';

drop function if exists public.request_account_deletion(uuid);
drop function if exists public.cancel_account_deletion();
drop table if exists public.account_deletion_requests;
drop type if exists public.deletion_request_status;

alter table public.profiles alter column status drop default;
create type public.account_status_current as enum ('active', 'restricted');
alter table public.profiles alter column status type public.account_status_current
  using status::text::public.account_status_current;
drop type public.account_status;
alter type public.account_status_current rename to account_status;
alter table public.profiles alter column status set default 'active';
